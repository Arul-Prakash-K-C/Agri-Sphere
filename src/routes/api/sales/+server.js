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
		const { inventoryId, itemName, category, quantity, unit, pricePerUnit, buyerName, notes, saleDate, type = 'Sale' } = body;

		if (!inventoryId || !itemName || !quantity || !unit) {
			return json({ error: 'inventoryId, itemName, quantity, and unit are required.' }, { status: 400 });
		}

		if (type === 'Sale' && pricePerUnit === undefined) {
			return json({ error: 'pricePerUnit is required for Sales.' }, { status: 400 });
		}

		const qty = Number(quantity);
		const price = type === 'Sale' ? Number(pricePerUnit) : 0;

		if (isNaN(qty) || qty <= 0) return json({ error: 'Quantity must be a positive number.' }, { status: 400 });
		if (type === 'Sale' && (isNaN(price) || price < 0)) return json({ error: 'Price must be a non-negative number.' }, { status: 400 });

		// Fetch and verify target inventory items
		let targetInventories = [];
		let totalAvailable = 0;

		if (inventoryId.startsWith('aggregate:')) {
			const cleanName = itemName.replace(/\s+Harvest$/i, '').trim().toLowerCase();
			const invSnapshot = await adminDb.collection('inventory')
				.where('farmerId', '==', locals.user.uid)
				.get();
			
			targetInventories = invSnapshot.docs
				.map(doc => ({ id: doc.id, ...doc.data() }))
				.filter(i => {
					const avail = (i.total || 0) - (i.soldUsed || 0);
					const cleanInvName = (i.cropName || i.name || '').replace(/\s+Harvest$/i, '').trim().toLowerCase();
					const nameMatch = cleanInvName === cleanName.replace(/\s+harvest$/i, '');
					return nameMatch && avail > 0.001 && i.status !== 'sold' && i.status !== 'Sold';
				});

			totalAvailable = targetInventories.reduce((sum, i) => sum + Math.max(0, (i.total || 0) - (i.soldUsed || 0)), 0);

			if (qty > totalAvailable) {
				return json({ error: `Not enough stock in these batches. Available: ${totalAvailable} ${unit}` }, { status: 400 });
			}

			// Sort by remainingLife ascending (lowest remaining life first, i.e., FIFO)
			targetInventories.sort((a, b) => {
				const lifeA = a.remainingLife === null || a.remainingLife === undefined ? Infinity : a.remainingLife;
				const lifeB = b.remainingLife === null || b.remainingLife === undefined ? Infinity : b.remainingLife;
				return lifeA - lifeB;
			});
		} else {
			const selectedInvRef = adminDb.collection('inventory').doc(inventoryId);
			const selectedInvSnap = await selectedInvRef.get();
			if (!selectedInvSnap.exists) return json({ error: 'Inventory item not found.' }, { status: 404 });
			const invData = selectedInvSnap.data();
			if (invData.farmerId !== locals.user.uid) return json({ error: 'Forbidden.' }, { status: 403 });

			totalAvailable = Math.max(0, Number(invData.total || 0) - Number(invData.soldUsed || 0));
			if (qty > totalAvailable) {
				return json({ error: `Not enough stock in this batch. Available: ${totalAvailable} ${unit}` }, { status: 400 });
			}
			targetInventories = [{ id: selectedInvSnap.id, ...invData }];
		}

		let remainingQty = qty;
		const deductions = [];
		const saleAllocations = [];
		const batch = adminDb.batch();

		for (const invData of targetInventories) {
			if (remainingQty <= 0.001) break;

			const availInInv = Math.max(0, Number(invData.total || 0) - Number(invData.soldUsed || 0));
			if (availInInv <= 0.001) continue;

			const toDeductFromInv = Math.min(remainingQty, availInInv);
			let deductedFromInv = 0;

			if (invData.sourceType === 'expense') {
				const expenseIds = invData.expenseIds || [];
				const expensesSnap = await Promise.all(
					expenseIds.map(eid => adminDb.collection('expenses').doc(eid).get())
				);
				let expenses = expensesSnap
					.map(snap => ({ id: snap.id, ...snap.data() }))
					.filter(e => e.itemDetails && e.itemDetails.status?.toLowerCase() !== 'sold');

				expenses.sort((a, b) => {
					return (a.createdAt || '').localeCompare(b.createdAt || '');
				});

				for (const e of expenses) {
					if (deductedFromInv >= toDeductFromInv - 0.001) break;

					const avail = Number(e.itemDetails?.quantity || 0);
					if (avail <= 0) continue;

					const deduct = Math.min(toDeductFromInv - deductedFromInv, avail);
					const eRef = adminDb.collection('expenses').doc(e.id);
					const newSoldUsed = (Number(e.itemDetails?.soldUsed) || 0) + deduct;

					if (deduct >= avail - 0.001) {
						// Fully sold
						batch.update(eRef, {
							'itemDetails.quantity': 0,
							'itemDetails.status': 'Sold',
							'itemDetails.soldUsed': newSoldUsed
						});
					} else {
						// Partially sold
						batch.update(eRef, {
							'itemDetails.quantity': avail - deduct,
							'itemDetails.status': 'Good',
							'itemDetails.soldUsed': newSoldUsed
						});
					}

					deductions.push({
						expenseId: e.id,
						quantitySold: deduct,
						quantity: deduct
					});

					saleAllocations.push({
						expenseId: e.id,
						quantitySold: deduct
					});

					deductedFromInv += deduct;
				}
			} else {
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

				for (const h of harvests) {
					if (deductedFromInv >= toDeductFromInv - 0.001) break;

					const avail = Number(h.quantity || 0);
					if (avail <= 0) continue;

					const deduct = Math.min(toDeductFromInv - deductedFromInv, avail);
					const hRef = adminDb.collection('harvests').doc(h.id);
					const newSoldUsed = (Number(h.soldUsed) || 0) + deduct;

					if (deduct >= avail - 0.001) {
						// Fully sold
						batch.update(hRef, {
							quantity: 0,
							status: 'Sold',
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
						quantitySold: deduct,
						quantity: deduct
					});

					saleAllocations.push({
						harvestId: h.id,
						quantitySold: deduct
					});

					deductedFromInv += deduct;
				}
			}

			remainingQty -= deductedFromInv;
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
			updatedAt: new Date().toISOString(),
			deductions,
			saleAllocations,
			type
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
