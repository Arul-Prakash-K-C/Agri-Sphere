import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user || locals.profile?.role !== 'manager') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('manager_requests')
			.where('managerId', '==', locals.user.uid)
			.get();
		
		const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		
		// Fetch farmer details for each request
		for (const req of requests) {
			if (req.farmerId) {
				const farmerDoc = await adminDb.collection('users').doc(req.farmerId).get();
				if (farmerDoc.exists) {
					req.farmer = farmerDoc.data();
				}
			}
		}

		requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
		return json(requests);
	} catch (error) {
		console.error('Error fetching manager requests:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user || locals.profile?.role !== 'manager') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { email } = await request.json();

		if (!email || typeof email !== 'string') {
			return json({ error: 'Farmer email is required' }, { status: 400 });
		}

		// Find the farmer by email
		const farmerSnapshot = await adminDb.collection('users')
			.where('email', '==', email.trim().toLowerCase())
			.where('role', '==', 'farmer')
			.limit(1)
			.get();

		if (farmerSnapshot.empty) {
			return json({ error: 'No farmer found with this email' }, { status: 404 });
		}

		const farmerId = farmerSnapshot.docs[0].id;

		// Check if a request already exists
		const existingReq = await adminDb.collection('manager_requests')
			.where('managerId', '==', locals.user.uid)
			.where('farmerId', '==', farmerId)
			.get();

		if (!existingReq.empty) {
			return json({ error: 'You have already requested access to this farm' }, { status: 400 });
		}

		const newRequest = {
			managerId: locals.user.uid,
			farmerId,
			status: 'Pending',
			requestedAt: new Date().toISOString(),
			respondedAt: null
		};

		const docRef = await adminDb.collection('manager_requests').add(newRequest);

		return json({ id: docRef.id, ...newRequest }, { status: 201 });
	} catch (error) {
		console.error('Error creating access request:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
