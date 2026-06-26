import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('expenses').doc(params.id);
		const expenseDoc = await docRef.get();

		if (!expenseDoc.exists) {
			return json({ error: 'Expense not found' }, { status: 404 });
		}

		if (expenseDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { category, description, amount, status, date } = body;

		// Manual Validation
		if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0)) {
			return json({ error: 'Category must be a non-empty string' }, { status: 400 });
		}
		if (description !== undefined && typeof description !== 'string') {
			return json({ error: 'Description must be a string' }, { status: 400 });
		}
		if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
			return json({ error: 'Amount must be a valid positive number' }, { status: 400 });
		}
		if (status !== undefined && !['Completed', 'Pending'].includes(status)) {
			return json({ error: 'Status must be Completed or Pending' }, { status: 400 });
		}

		const updatePayload = {};
		if (category !== undefined) updatePayload.category = category;
		if (description !== undefined) updatePayload.description = description;
		if (amount !== undefined) updatePayload.amount = Number(amount);
		
		if (status !== undefined) {
			updatePayload.status = status;
			updatePayload.statusColor = status === 'Completed'
				? 'bg-emerald-50 text-dark-green border-emerald-100/50'
				: 'bg-amber-50 text-amber-800 border-amber-100/50';
		}
		if (date !== undefined) {
			updatePayload.date = new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
			updatePayload.rawDate = new Date(date).toISOString();
		}

		await docRef.update(updatePayload);
		const updatedDoc = await docRef.get();

		return json({ id: updatedDoc.id, ...updatedDoc.data() });
	} catch (error) {
		console.error('Error updating expense:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('expenses').doc(params.id);
		const expenseDoc = await docRef.get();

		if (!expenseDoc.exists) {
			return json({ error: 'Expense not found' }, { status: 404 });
		}

		if (expenseDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();
		return json({ success: true, message: 'Expense deleted successfully' });
	} catch (error) {
		console.error('Error deleting expense:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
