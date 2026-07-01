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
		const cropsSnapshot = await adminDb.collection('crops')
			.where('farmerId', '==', locals.user.uid)
			.get();
		
		const crops = cropsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		return json(crops);
	} catch (error) {
		console.error('Error fetching crops:', error);
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
		const { name, location, plantedDate, harvestDuration, acres, imageUrl } = body;

		// Manual Validation
		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: 'Crop name is required' }, { status: 400 });
		}
		if (!location || typeof location !== 'string' || location.trim().length === 0) {
			return json({ error: 'Location is required' }, { status: 400 });
		}
		if (!harvestDuration || typeof harvestDuration !== 'string' || harvestDuration.trim().length === 0) {
			return json({ error: 'Harvest Duration is required' }, { status: 400 });
		}
		if (acres === undefined || isNaN(Number(acres)) || Number(acres) <= 0) {
			return json({ error: 'Acres must be a valid positive number' }, { status: 400 });
		}

		const newCrop = {
			name,
			location,
			plantedDate: plantedDate || new Date().toISOString().split('T')[0],
			harvestDuration,
			acres: Number(acres),
			imageUrl: imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
			farmerId: locals.user.uid,
			createdAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('crops').add(newCrop);

		await adminDb.collection('notifications').add({
			title: 'New Crop Registered',
			message: `Crop "${name}" has been registered in "${location}" (${acres} Acres).`,
			read: false,
			type: 'crop',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ id: docRef.id, ...newCrop }, { status: 201 });
	} catch (error) {
		console.error('Error creating crop:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
