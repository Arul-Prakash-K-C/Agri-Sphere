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

		// Sync inventory — find the linked inventory item by sourceId
		const merged = { ...harvestDoc.data(), ...updatePayload };
		const invSnapshot = await adminDb.collection('inventory')
			.where('farmerId', '==', locals.user.uid)
			.where('sourceType', '==', 'harvest')
			.where('sourceId', '==', params.id)
			.get();

		if (!invSnapshot.empty) {
			const invDoc = invSnapshot.docs[0];
			const newTotal = Number(merged.quantity);
			const progress = 100;
			await invDoc.ref.update({
				name: merged.cropName + ' Harvest',
				category: merged.category || 'Vegetables',
				storageId: merged.storageId || '',
				total: newTotal,
				unit: merged.unit,
				progress,
				updatedAt: new Date().toISOString()
			});
		}

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

		// Delete linked inventory item first
		const invSnapshot = await adminDb.collection('inventory')
			.where('farmerId', '==', locals.user.uid)
			.where('sourceType', '==', 'harvest')
			.where('sourceId', '==', params.id)
			.get();

		const batch = adminDb.batch();
		invSnapshot.docs.forEach(doc => batch.delete(doc.ref));
		batch.delete(docRef);
		await batch.commit();

		return json({ success: true, message: 'Harvest log deleted successfully' });
	} catch (error) {
		console.error('Error deleting harvest log:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
