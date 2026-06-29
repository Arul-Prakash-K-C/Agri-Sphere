import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (locals.profile?.role !== 'farmer') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const saleRef = adminDb.collection('sales').doc(params.id);
		const saleSnap = await saleRef.get();

		if (!saleSnap.exists) return json({ error: 'Sale not found.' }, { status: 404 });

		const sale = saleSnap.data();
		if (sale.farmerId !== locals.user.uid) return json({ error: 'Forbidden.' }, { status: 403 });

		// Reverse the inventory deduction
		if (sale.deductions && Array.isArray(sale.deductions)) {
			const batch = adminDb.batch();
			for (const ded of sale.deductions) {
				const invRef = adminDb.collection('inventory').doc(ded.inventoryId);
				const invSnap = await invRef.get();
				if (invSnap.exists) {
					const currentSoldUsed = Number(invSnap.data().soldUsed || 0);
					const newSoldUsed = Math.max(0, currentSoldUsed - Number(ded.quantity || 0));
					batch.update(invRef, { soldUsed: newSoldUsed });

					// Revert harvest status if it was sold
					const invData = invSnap.data();
					const harvestIds = invData.harvestIds || (invData.sourceId ? [invData.sourceId] : []);
					if (newSoldUsed < Number(invData.total || 0)) {
						for (const hid of harvestIds) {
							batch.update(adminDb.collection('harvests').doc(hid), {
								status: ''
							});
						}
					}
				}
			}
			batch.delete(saleRef);
			await batch.commit();
		} else if (sale.inventoryId) {
			const invRef = adminDb.collection('inventory').doc(sale.inventoryId);
			const invSnap = await invRef.get();
			if (invSnap.exists && invSnap.data().farmerId === locals.user.uid) {
				const currentSoldUsed = Number(invSnap.data().soldUsed || 0);
				const newSoldUsed = Math.max(0, currentSoldUsed - Number(sale.quantity || 0));
				await invRef.update({ soldUsed: newSoldUsed });

				const invData = invSnap.data();
				const harvestIds = invData.harvestIds || (invData.sourceId ? [invData.sourceId] : []);
				if (newSoldUsed < Number(invData.total || 0)) {
					for (const hid of harvestIds) {
						await adminDb.collection('harvests').doc(hid).update({
							status: ''
						});
					}
				}
			}
			await saleRef.delete();
		} else {
			await saleRef.delete();
		}
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
