import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const todoId = params.id;
		const docRef = adminDb.collection('todos').doc(todoId);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Todo not found' }, { status: 404 });
		}

		if (docSnap.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const updates = { ...body, updatedAt: new Date().toISOString() };
		
		// Ensure farmerId is not overwritten
		delete updates.farmerId;
		delete updates.id;
		delete updates.createdAt;

		await docRef.update(updates);

		return json({ success: true, updatedFields: updates });
	} catch (error) {
		console.error('Error updating todo:', error);
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
		const todoId = params.id;
		const docRef = adminDb.collection('todos').doc(todoId);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Todo not found' }, { status: 404 });
		}

		if (docSnap.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting todo:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
