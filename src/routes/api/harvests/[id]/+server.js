import { json } from '@sveltejs/kit';
import { adminDb, syncInventoryForFarmer } from '$lib/server/firebase-admin';

function convertToUnit(amount, fromUnit, toUnit) {
	if (!amount || isNaN(amount)) return 0;
	const from = (fromUnit || '').trim().toLowerCase();
	const to = (toUnit || '').trim().toLowerCase();
	if (from === to) return amount;
	
	if (from === 'kg' && to === 'tons') return amount / 1000;
	if (from === 'tons' && to === 'kg') return amount * 1000;
	if (from === 'g' && to === 'kg') return amount / 1000;
	if (from === 'kg' && to === 'g') return amount * 1000;
	if (from === 'ml' && to === 'liters') return amount / 1000;
	if (from === 'liters' && to === 'ml') return amount * 1000;

	return amount;
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('harvests').doc(params.id);
		const harvestDoc = await docRef.get();

		if (!harvestDoc.exists) {
			return json({ error: 'Harvest log not found' }, { status: 404 });
		}

		if (harvestDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { cropName, cropId, lifespan, quantity, unit, harvestDate, qualityGrade, notes, category, storageId } = body;

		// Validation
		if (cropName !== undefined && (typeof cropName !== 'string' || cropName.trim().length === 0)) {
			return json({ error: 'Crop name must be a non-empty string' }, { status: 400 });
		}
		if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) <= 0)) {
			return json({ error: 'Quantity must be a positive number' }, { status: 400 });
		}

		const targetStorageId = storageId !== undefined ? storageId : harvestDoc.data().storageId;
		const targetQuantity = quantity !== undefined ? Number(quantity) : Number(harvestDoc.data().quantity);
		const targetUnit = unit !== undefined ? unit : harvestDoc.data().unit;

		if (targetStorageId) {
			const storageSnap = await adminDb.collection('storages').doc(targetStorageId).get();
			if (!storageSnap.exists) {
				return json({ error: 'Storage location not found' }, { status: 400 });
			}
			const storage = storageSnap.data();
			if (storage.farmerId !== locals.user.uid) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			// Get occupied space excluding the inventory item linked to this harvest
			const invSnapshot = await adminDb.collection('inventory')
				.where('farmerId', '==', locals.user.uid)
				.where('storageId', '==', targetStorageId)
				.get();
			const occupied = invSnapshot.docs
				.filter(doc => {
					const data = doc.data();
					if (data.harvestIds && Array.isArray(data.harvestIds)) {
						return !data.harvestIds.includes(params.id);
					}
					return data.sourceId !== params.id;
				})
				.reduce((sum, doc) => {
					const item = doc.data();
					return sum + convertToUnit(((item.total || 0) - (item.soldUsed || 0)), item.unit, storage.unit);
				}, 0);

			const avail = Math.max(0, storage.capacity - occupied);
			const quantityInStorageUnit = convertToUnit(targetQuantity, targetUnit || 'Liters', storage.unit);
			if (quantityInStorageUnit > avail) {
				return json({ error: `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}.` }, { status: 400 });
			}
		}

		const updatePayload = {};
		if (cropName !== undefined) updatePayload.cropName = cropName.trim();
		if (cropId !== undefined) updatePayload.cropId = cropId;
		if (lifespan !== undefined) updatePayload.lifespan = lifespan;
		if (quantity !== undefined) updatePayload.quantity = Number(quantity);
		if (unit !== undefined) updatePayload.unit = unit;
		if (harvestDate !== undefined) updatePayload.harvestDate = harvestDate;
		if (qualityGrade !== undefined) updatePayload.qualityGrade = qualityGrade;
		if (notes !== undefined) updatePayload.notes = notes;
		if (category !== undefined) updatePayload.category = category;
		if (storageId !== undefined) updatePayload.storageId = storageId;
		updatePayload.updatedAt = new Date().toISOString();

		await docRef.update(updatePayload);

		await syncInventoryForFarmer(locals.user.uid);

		const updatedDoc = await docRef.get();
		return json({ id: updatedDoc.id, ...updatedDoc.data() });
	} catch (error) {
		console.error('Error updating harvest log:', error);
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
		const docRef = adminDb.collection('harvests').doc(params.id);
		const harvestDoc = await docRef.get();

		if (!harvestDoc.exists) {
			return json({ error: 'Harvest log not found' }, { status: 404 });
		}

		if (harvestDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();
		await syncInventoryForFarmer(locals.user.uid);

		return json({ success: true, message: 'Harvest log deleted successfully' });
	} catch (error) {
		console.error('Error deleting harvest log:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
