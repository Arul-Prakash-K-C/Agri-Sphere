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
		const snapshot = await adminDb.collection('storages')
			.where('farmerId', '==', locals.user.uid)
			.get();

		let storages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Sort client-side by name or createdAt
		storages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

		// Seed initial default storages if empty
		if (storages.length === 0) {
			const now = new Date().toISOString();
			const defaultStorages = [
				{
					name: 'Silo 1',
					capacity: 1000,
					unit: 'Bags',
					categories: ['Grains'],
					farmerId: locals.user.uid,
					createdAt: now
				},
				{
					name: 'Silo 2',
					capacity: 1000,
					unit: 'Bags',
					categories: ['Seeds'],
					farmerId: locals.user.uid,
					createdAt: now
				},
				{
					name: 'Cold Storage',
					capacity: 500,
					unit: 'kg',
					categories: ['Vegetables', 'Fruits'],
					farmerId: locals.user.uid,
					createdAt: now
				}
			];

			for (const item of defaultStorages) {
				const docRef = await adminDb.collection('storages').add(item);
				storages.push({ id: docRef.id, ...item });
			}
		}

		return json(storages);
	} catch (error) {
		console.error('Error fetching storages:', error);
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
		const { name, capacity, unit, categories } = body;

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: 'Storage name is required' }, { status: 400 });
		}
		if (capacity === undefined || isNaN(Number(capacity)) || Number(capacity) <= 0) {
			return json({ error: 'Capacity must be a positive number' }, { status: 400 });
		}
		if (!unit || typeof unit !== 'string') {
			return json({ error: 'Unit is required' }, { status: 400 });
		}
		if (!Array.isArray(categories) || categories.length === 0) {
			return json({ error: 'At least one category is required' }, { status: 400 });
		}

		const now = new Date().toISOString();
		const newStorage = {
			name: name.trim(),
			capacity: Number(capacity),
			unit: unit.trim(),
			categories,
			farmerId: locals.user.uid,
			createdAt: now
		};

		const docRef = await adminDb.collection('storages').add(newStorage);
		return json({ id: docRef.id, ...newStorage }, { status: 201 });
	} catch (error) {
		console.error('Error creating storage:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
