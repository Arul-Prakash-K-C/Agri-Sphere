import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (locals.profile?.role !== 'farmer') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const snapshot = await adminDb.collection('sales')
			.where('farmerId', '==', locals.user.uid)
			.get();

		const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		sales.sort((a, b) => new Date(b.saleDate || b.createdAt) - new Date(a.saleDate || a.createdAt));
		return json(sales);
	} catch (error) {
		console.error('Error fetching sales:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (locals.profile?.role !== 'farmer') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json();
		const { inventoryId, itemName, category, quantity, unit, pricePerUnit, buyerName, notes, saleDate } = body;

		if (!inventoryId || !itemName || !quantity || !unit || pricePerUnit === undefined) {
			return json({ error: 'inventoryId, itemName, quantity, unit, and pricePerUnit are required.' }, { status: 400 });
		}

		const qty = Number(quantity);
		const price = Number(pricePerUnit);

		if (isNaN(qty) || qty <= 0) return json({ error: 'Quantity must be a positive number.' }, { status: 400 });
		if (isNaN(price) || price < 0) return json({ error: 'Price must be a non-negative number.' }, { status: 400 });

		// Verify inventory item belongs to farmer
		const invRef = adminDb.collection('inventory').doc(inventoryId);
		const invSnap = await invRef.get();
		if (!invSnap.exists) return json({ error: 'Inventory item not found.' }, { status: 404 });
		if (invSnap.data().farmerId !== locals.user.uid) return json({ error: 'Forbidden.' }, { status: 403 });

		const currentSoldUsed = Number(invSnap.data().soldUsed || 0);
		const currentTotal = Number(invSnap.data().total || 0);
		const newSoldUsed = currentSoldUsed + qty;

		if (newSoldUsed > currentTotal) {
			return json({ error: `Not enough stock. Available: ${currentTotal - currentSoldUsed} ${unit}` }, { status: 400 });
		}

		const newSale = {
			farmerId: locals.user.uid,
			inventoryId,
			itemName: itemName.trim(),
			category: category || '',
			quantity: qty,
			unit,
			pricePerUnit: price,
			totalAmount: Math.round(qty * price * 100) / 100,
			buyerName: buyerName ? buyerName.trim() : '',
			notes: notes ? notes.trim() : '',
			saleDate: saleDate ? new Date(saleDate).toISOString() : new Date().toISOString(),
			createdAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('sales').add(newSale);
		await invRef.update({ soldUsed: newSoldUsed });

		return json({ id: docRef.id, ...newSale }, { status: 201 });
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
