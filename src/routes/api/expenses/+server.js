import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('expenses')
			.where('farmerId', '==', locals.user.uid)
			.get();
		
		const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		return json(expenses);
	} catch (error) {
		console.error('Error fetching expenses:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { category, description, amount, status, date, itemDetails } = body;

		// Manual Validation
		if (!category || typeof category !== 'string' || category.trim().length === 0) {
			return json({ error: 'Category is required' }, { status: 400 });
		}
		if (!description || typeof description !== 'string') {
			return json({ error: 'Description must be a string' }, { status: 400 });
		}
		if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
			return json({ error: 'Amount must be a valid positive number' }, { status: 400 });
		}
		if (!status || !['Completed', 'Pending'].includes(status)) {
			return json({ error: 'Status must be Completed or Pending' }, { status: 400 });
		}

		const statusColor = status === 'Completed'
			? 'bg-emerald-50 text-dark-green border-emerald-100/50'
			: 'bg-amber-50 text-amber-800 border-amber-100/50';

		const newExpense = {
			category,
			description,
			amount: Number(amount),
			status,
			statusColor,
			date: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
			rawDate: date ? new Date(date).toISOString() : new Date().toISOString(),
			farmerId: locals.user.uid,
			createdAt: new Date().toISOString()
		};

		// Check if details are needed
		if (['Seed', 'Fertilizer', 'Chemicals'].includes(category) && itemDetails) {
			if (!itemDetails.itemName || typeof itemDetails.itemName !== 'string' || itemDetails.itemName.trim().length === 0) {
				return json({ error: 'Item Name is required for this category' }, { status: 400 });
			}
			if (itemDetails.quantity === undefined || isNaN(Number(itemDetails.quantity)) || Number(itemDetails.quantity) <= 0) {
				return json({ error: 'Quantity must be a positive number' }, { status: 400 });
			}
			if (!itemDetails.unit || typeof itemDetails.unit !== 'string' || itemDetails.unit.trim().length === 0) {
				return json({ error: 'Unit is required' }, { status: 400 });
			}

			newExpense.itemDetails = {
				itemName: itemDetails.itemName.trim(),
				brand: itemDetails.brand ? itemDetails.brand.trim() : '',
				quantity: Number(itemDetails.quantity),
				unit: itemDetails.unit.trim(),
				costPerUnit: itemDetails.costPerUnit ? Number(itemDetails.costPerUnit) : null,
				notes: itemDetails.notes ? itemDetails.notes.trim() : ''
			};
		}

		const docRef = await adminDb.collection('expenses').add(newExpense);
		return json({ id: docRef.id, ...newExpense }, { status: 201 });
	} catch (error) {
		console.error('Error creating expense:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
