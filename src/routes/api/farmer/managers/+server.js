import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user || locals.profile?.role !== 'farmer') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('manager_requests')
			.where('farmerId', '==', locals.user.uid)
			.get();
		
		const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		
		// Fetch manager details
		for (const req of requests) {
			if (req.managerId) {
				const managerDoc = await adminDb.collection('users').doc(req.managerId).get();
				if (managerDoc.exists) {
					req.manager = managerDoc.data();
				}
			}
		}

		requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
		return json(requests);
	} catch (error) {
		console.error('Error fetching manager requests for farmer:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, locals }) {
	if (!locals.user || locals.profile?.role !== 'farmer') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { requestId, status } = await request.json();

		if (!requestId || !['Accepted', 'Rejected', 'Revoked'].includes(status)) {
			return json({ error: 'Invalid request data' }, { status: 400 });
		}

		const reqRef = adminDb.collection('manager_requests').doc(requestId);
		const doc = await reqRef.get();

		if (!doc.exists) {
			return json({ error: 'Request not found' }, { status: 404 });
		}

		if (doc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Unauthorized to modify this request' }, { status: 403 });
		}

		await reqRef.update({
			status: status === 'Revoked' ? 'Rejected' : status,
			respondedAt: new Date().toISOString()
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error updating manager request:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
