import { json } from '@sveltejs/kit';
import { adminDb, syncInventoryForFarmer } from '$lib/server/firebase-admin';

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

		// Verify selected inventory item belongs to farmer
		const selectedInvRef = adminDb.collection('inventory').doc(inventoryId);
		const selectedInvSnap = await selectedInvRef.get();
		if (!selectedInvSnap.exists) return json({ error: 'Inventory item not found.' }, { status: 404 });
		const invData = selectedInvSnap.data();
		if (invData.farmerId !== locals.user.uid) return json({ error: 'Forbidden.' }, { status: 403 });

		// Verify available quantity in the selected batch
		const totalAvailable = Math.max(0, Number(invData.total || 0) - Number(invData.soldUsed || 0));
		if (qty > totalAvailable) {
			return json({ error: `Not enough stock in this batch. Available: ${totalAvailable} ${unit}` }, { status: 400 });
		}

		// Fetch the harvests associated with this inventory batch
		const harvestIds = invData.harvestIds || [];
		const harvestsSnap = await Promise.all(
			harvestIds.map(hid => adminDb.collection('harvests').doc(hid).get())
		);
		
		let harvests = harvestsSnap
			.map(snap => ({ id: snap.id, ...snap.data() }))
			.filter(h => h.status !== 'sold' && h.status !== 'Sold');

		// Sort by createdAt ascending (FIFO)
		harvests.sort((a, b) => {
			return (a.createdAt || a.harvestDate || '').localeCompare(b.createdAt || b.harvestDate || '');
		});

		let remainingQty = qty;
		const deductions = [];
		const batch = adminDb.batch();

		for (const h of harvests) {
			const avail = Number(h.quantity || 0);
			if (avail <= 0) continue;

			const deduct = Math.min(remainingQty, avail);
			const hRef = adminDb.collection('harvests').doc(h.id);
			const newSoldUsed = (Number(h.soldUsed) || 0) + deduct;

			if (deduct >= avail - 0.001) {
				// Fully sold
				batch.update(hRef, {
					status: 'sold',
					soldUsed: newSoldUsed
				});
			} else {
				// Partially sold
				batch.update(hRef, {
					quantity: avail - deduct,
					soldUsed: newSoldUsed,
					status: 'Good'
				});
			}

			deductions.push({
				harvestId: h.id,
				quantity: deduct
			});

			remainingQty -= deduct;
			if (remainingQty <= 0.001) break;
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
			createdAt: new Date().toISOString(),
			deductions
		};

		const saleDocRef = adminDb.collection('sales').doc();
		batch.set(saleDocRef, newSale);

		await batch.commit();

		// Synchronize inventory immediately after sale
		await syncInventoryForFarmer(locals.user.uid);

		return json({ id: saleDocRef.id, ...newSale }, { status: 201 });
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
