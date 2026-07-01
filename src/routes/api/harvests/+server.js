import { json } from '@sveltejs/kit';
import { adminDb, upsertInventoryFromHarvest } from '$lib/server/firebase-admin';

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
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('harvests')
			.where('farmerId', '==', locals.user.uid)
			.get();

		let harvests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		
		// Sort client-side to avoid index requirement
		harvests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

		return json(harvests);
	} catch (error) {
		console.error('Error fetching harvests:', error);
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
		const { cropName, cropId, lifespan, quantity, unit, harvestDate, qualityGrade, notes, category, storageId } = body;

		// Validation
		if (!cropName || typeof cropName !== 'string' || cropName.trim().length === 0) {
			return json({ error: 'Crop name is required' }, { status: 400 });
		}
		if (quantity === undefined || isNaN(Number(quantity)) || Number(quantity) <= 0) {
			return json({ error: 'Quantity must be a positive number' }, { status: 400 });
		}
		if (!harvestDate || typeof harvestDate !== 'string') {
			return json({ error: 'Harvest date is required' }, { status: 400 });
		}

		if (storageId) {
			const storageSnap = await adminDb.collection('storages').doc(storageId).get();
			if (!storageSnap.exists) {
				return json({ error: 'Storage location not found' }, { status: 400 });
			}
			const storage = storageSnap.data();
			if (storage.farmerId !== locals.user.uid) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			// Get occupied space
			const invSnapshot = await adminDb.collection('inventory')
				.where('farmerId', '==', locals.user.uid)
				.where('storageId', '==', storageId)
				.get();
			const occupied = invSnapshot.docs.reduce((sum, doc) => {
				const item = doc.data();
				return sum + convertToUnit(((item.total || 0) - (item.soldUsed || 0)), item.unit, storage.unit);
			}, 0);

			const avail = Math.max(0, storage.capacity - occupied);
			const quantityInStorageUnit = convertToUnit(Number(quantity), unit || 'Liters', storage.unit);
			if (quantityInStorageUnit > avail) {
				return json({ error: `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}.` }, { status: 400 });
			}
		}

		const now = new Date().toISOString();
		const newHarvest = {
			cropName: cropName.trim(),
			cropId: cropId || '',
			lifespan: lifespan || '',
			quantity: Number(quantity),
			unit: unit || 'Liters',
			harvestDate,
			qualityGrade: qualityGrade || 'Grade A',
			notes: notes || '',
			category: category || 'Vegetables',
			storageId: storageId || '',
			farmerId: locals.user.uid,
			createdAt: now
		};

		const docRef = await adminDb.collection('harvests').add(newHarvest);
		await upsertInventoryFromHarvest(locals.user.uid, { id: docRef.id, ...newHarvest });

		await adminDb.collection('notifications').add({
			title: 'Harvest Logged',
			message: `Harvest logged: ${quantity} ${unit} of "${cropName}".`,
			read: false,
			type: 'harvest',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ id: docRef.id, ...newHarvest }, { status: 201 });
	} catch (error) {
		console.error('Error creating harvest log:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
