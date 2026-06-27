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
		const snapshot = await adminDb.collection('harvests')
			.where('farmerId', '==', locals.user.uid)
			.orderBy('createdAt', 'desc')
			.get();

		let harvests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Seed initial harvest logs if empty
		if (harvests.length === 0) {
			const seedHarvests = [
				{
					cropName: 'Basmati Rice',
					cropId: '',
					lifespan: '120 Days',
					quantity: 90,
					unit: 'Liters',
					harvestDate: '2026-06-24',
					qualityGrade: 'Grade A',
					notes: 'Premium yield from North Valley fields.',
					farmerId: locals.user.uid,
					createdAt: new Date().toISOString()
				},
				{
					cropName: 'Sweet Corn',
					cropId: '',
					lifespan: 'Seasonal (Jun, Jul, Aug)',
					quantity: 45,
					unit: 'Liters',
					harvestDate: '2026-06-18',
					qualityGrade: 'Grade A+',
					notes: 'Excellent moisture content and grain quality.',
					farmerId: locals.user.uid,
					createdAt: new Date().toISOString()
				}
			];

			for (const item of seedHarvests) {
				const docRef = await adminDb.collection('harvests').add(item);
				harvests.push({ id: docRef.id, ...item });
			}
		}

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
		const { cropName, cropId, lifespan, quantity, unit, harvestDate, qualityGrade, notes } = body;

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
			farmerId: locals.user.uid,
			createdAt: now
		};

		const docRef = await adminDb.collection('harvests').add(newHarvest);
		const harvestId = docRef.id;

		// Upsert inventory: add a harvest-linked inventory record
		const invQuery = adminDb.collection('inventory')
			.where('farmerId', '==', locals.user.uid)
			.where('sourceType', '==', 'harvest')
			.where('sourceId', '==', harvestId);

		const existingInv = await invQuery.get();

		if (existingInv.empty) {
			await adminDb.collection('inventory').add({
				name: cropName.trim() + ' Harvest',
				category: 'Harvest',
				icon: 'inventory_2',
				total: Number(quantity),
				soldUsed: 0,
				unit: unit || 'Liters',
				progress: 100,
				status: 'Optimal',
				statusColor: 'bg-emerald-50 text-dark-green border-emerald-100/50',
				sourceType: 'harvest',
				sourceId: harvestId,
				farmerId: locals.user.uid,
				createdAt: now
			});
		}

		return json({ id: harvestId, ...newHarvest }, { status: 201 });
	} catch (error) {
		console.error('Error creating harvest log:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
