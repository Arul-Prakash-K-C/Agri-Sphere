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
		const docRef = adminDb.collection('storages').doc(params.id);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Storage not found' }, { status: 404 });
		}

		if (docSnap.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { name, capacity, unit, categories } = body;

		const updatePayload = {};
		if (name !== undefined) {
			if (typeof name !== 'string' || name.trim().length === 0) {
				return json({ error: 'Storage name cannot be empty' }, { status: 400 });
			}
			updatePayload.name = name.trim();
		}
		if (capacity !== undefined) {
			if (isNaN(Number(capacity)) || Number(capacity) <= 0) {
				return json({ error: 'Capacity must be a positive number' }, { status: 400 });
			}
			updatePayload.capacity = Number(capacity);
		}
		if (unit !== undefined) {
			if (typeof unit !== 'string' || unit.trim().length === 0) {
				return json({ error: 'Unit cannot be empty' }, { status: 400 });
			}
			updatePayload.unit = unit.trim();
		}
		if (categories !== undefined) {
			if (!Array.isArray(categories) || categories.length === 0) {
				return json({ error: 'At least one category is required' }, { status: 400 });
			}
			updatePayload.categories = categories;
		}

		updatePayload.updatedAt = new Date().toISOString();

		await docRef.update(updatePayload);

		const updatedDoc = await docRef.get();
		return json({ id: updatedDoc.id, ...updatedDoc.data() });
	} catch (error) {
		console.error('Error updating storage:', error);
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
		const docRef = adminDb.collection('storages').doc(params.id);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Storage not found' }, { status: 404 });
		}

		if (docSnap.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();
		return json({ success: true, message: 'Storage deleted successfully' });
	} catch (error) {
		console.error('Error deleting storage:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
