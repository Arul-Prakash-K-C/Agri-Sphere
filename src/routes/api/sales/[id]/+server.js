import { json } from '@sveltejs/kit';
import { adminDb, syncInventoryForFarmer } from '$lib/server/firebase-admin';

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

		const allocations = sale.saleAllocations || sale.deductions || [];

		// Reverse the inventory deduction
		if (allocations && Array.isArray(allocations)) {
			const batch = adminDb.batch();
			for (const ded of allocations) {
				if (ded.harvestId) {
					const hRef = adminDb.collection('harvests').doc(ded.harvestId);
					const hSnap = await hRef.get();
					if (hSnap.exists) {
						const hData = hSnap.data();
						const currentQty = Number(hData.quantity || 0);
						const currentSoldUsed = Number(hData.soldUsed || 0);
						const dedQty = Number(ded.quantitySold || ded.quantity || 0);

						const newQty = currentQty + dedQty;
						const newSoldUsed = Math.max(0, currentSoldUsed - dedQty);
						const newStatus = newQty > 0 ? 'Good' : 'Sold';

						batch.update(hRef, {
							quantity: newQty,
							soldUsed: newSoldUsed,
							status: newStatus
						});
					}
				} else if (ded.expenseId) {
					const eRef = adminDb.collection('expenses').doc(ded.expenseId);
					const eSnap = await eRef.get();
					if (eSnap.exists) {
						const eData = eSnap.data();
						const details = eData.itemDetails || {};
						const currentQty = Number(details.quantity || 0);
						const currentSoldUsed = Number(details.soldUsed || 0);
						const dedQty = Number(ded.quantitySold || ded.quantity || 0);

						const newQty = currentQty + dedQty;
						const newSoldUsed = Math.max(0, currentSoldUsed - dedQty);
						const newStatus = newQty > 0 ? 'Good' : 'Sold';

						batch.update(eRef, {
							'itemDetails.quantity': newQty,
							'itemDetails.soldUsed': newSoldUsed,
							'itemDetails.status': newStatus
						});
					}
				} else if (ded.inventoryId) {
					// Fallback for older legacy schema deductions
					const invRef = adminDb.collection('inventory').doc(ded.inventoryId);
					const invSnap = await invRef.get();
					if (invSnap.exists) {
						const currentSoldUsed = Number(invSnap.data().soldUsed || 0);
						const newSoldUsed = Math.max(0, currentSoldUsed - Number(ded.quantity || 0));
						batch.update(invRef, { soldUsed: newSoldUsed });
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

		// Re-sync inventory immediately to update batch statuses and totals
		await syncInventoryForFarmer(locals.user.uid);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request, locals }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (locals.profile?.role !== 'farmer') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json();
		const { buyerName, pricePerUnit, totalAmount, saleDate, notes } = body;

		const saleRef = adminDb.collection('sales').doc(params.id);
		const saleSnap = await saleRef.get();
		if (!saleSnap.exists) {
			return json({ error: 'Sale not found.' }, { status: 404 });
		}

		const saleData = saleSnap.data();
		if (saleData.farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden.' }, { status: 403 });
		}

		// Validation: if it is a Sale, require at least one of pricePerUnit or totalAmount
		let price = 0;
		let total = 0;
		if (saleData.type === 'Sale' || !saleData.type) {
			if (pricePerUnit === undefined && totalAmount === undefined) {
				return json({ error: 'At least one of Price or Total is required.' }, { status: 400 });
			}
			price = Number(pricePerUnit);
			total = Number(totalAmount);
			if (isNaN(price) || price < 0 || isNaN(total) || total < 0) {
				return json({ error: 'Price and total must be non-negative numbers.' }, { status: 400 });
			}
		}

		const updatedData = {
			buyerName: buyerName ? buyerName.trim() : '',
			pricePerUnit: (saleData.type === 'Sale' || !saleData.type) ? Math.round(price * 100) / 100 : 0,
			totalAmount: (saleData.type === 'Sale' || !saleData.type) ? Math.round(total * 100) / 100 : 0,
			saleDate: saleDate ? new Date(saleDate).toISOString() : saleData.saleDate,
			notes: notes ? notes.trim() : '',
			updatedAt: new Date().toISOString()
		};

		await saleRef.update(updatedData);

		// Synchronize inventory
		await syncInventoryForFarmer(locals.user.uid);

		return json({ success: true, ...updatedData });
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
