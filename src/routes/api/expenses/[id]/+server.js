import { json } from '@sveltejs/kit';
import { adminDb, syncInventoryForFarmer } from '$lib/server/firebase-admin';

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
		const { category, description, amount, status, date, itemDetails } = body;

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

		// Handle item details
		const targetCategory = category !== undefined ? category : expenseDoc.data().category;
		if (['Seed', 'Fertilizer', 'Chemicals'].includes(targetCategory)) {
			if (itemDetails) {
				if (!itemDetails.itemName || typeof itemDetails.itemName !== 'string' || itemDetails.itemName.trim().length === 0) {
					return json({ error: 'Item Name is required for this category' }, { status: 400 });
				}
				if (itemDetails.quantity === undefined || isNaN(Number(itemDetails.quantity)) || Number(itemDetails.quantity) <= 0) {
					return json({ error: 'Quantity must be a positive number' }, { status: 400 });
				}
				if (!itemDetails.unit || typeof itemDetails.unit !== 'string' || itemDetails.unit.trim().length === 0) {
					return json({ error: 'Unit is required' }, { status: 400 });
				}

				updatePayload.itemDetails = {
					itemName: itemDetails.itemName.trim(),
					brand: itemDetails.brand ? itemDetails.brand.trim() : '',
					quantity: Number(itemDetails.quantity),
					unit: itemDetails.unit.trim(),
					costPerUnit: itemDetails.costPerUnit ? Number(itemDetails.costPerUnit) : null,
					notes: itemDetails.notes ? itemDetails.notes.trim() : '',
					storageId: itemDetails.storageId ? itemDetails.storageId.trim() : '',
					soldUsed: expenseDoc.data().itemDetails?.soldUsed || 0,
					status: expenseDoc.data().itemDetails?.status || 'Good'
				};
			}
		} else {
			// If not in conditional categories, remove itemDetails field by setting to delete
			// In Firestore Admin SDK we can use FieldValue.delete() to remove the property
			const { FieldValue } = await import('firebase-admin/firestore');
			updatePayload.itemDetails = FieldValue.delete();
		}

		await docRef.update(updatePayload);
		const updatedDoc = await docRef.get();

		if (['Seed', 'Fertilizer', 'Chemicals'].includes(targetCategory)) {
			await syncInventoryForFarmer(locals.user.uid);
		}

		await adminDb.collection('notifications').add({
			title: 'Expense Updated',
			message: `Expense of category "${updatedDoc.data().category}" has been updated.`,
			read: false,
			type: 'expense',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

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

		// Check if this expense is linked to any sales
		const salesSnapshot = await adminDb.collection('sales')
			.where('farmerId', '==', locals.user.uid)
			.get();
		const sales = salesSnapshot.docs.map(doc => doc.data());
		
		const isLinkedToSales = sales.some(sale => {
			const allocations = sale.saleAllocations || sale.deductions || [];
			return allocations.some(alloc => alloc.expenseId === params.id);
		});

		if (isLinkedToSales) {
			return json({ error: 'This expense is linked to sales and cannot be deleted.' }, { status: 400 });
		}

		await docRef.delete();
		await syncInventoryForFarmer(locals.user.uid);

		await adminDb.collection('notifications').add({
			title: 'Expense Deleted',
			message: `Expense of category "${expenseDoc.data().category}" has been deleted.`,
			read: false,
			type: 'expense',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ success: true, message: 'Expense deleted successfully' });
	} catch (error) {
		console.error('Error deleting expense:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
