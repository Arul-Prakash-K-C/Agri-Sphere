import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user || locals.profile?.role !== 'manager') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('users')
			.where('role', '==', 'farmer')
			.get();
		
		const farms = snapshot.docs.map(doc => ({
			id: doc.id,
			farmName: doc.data().farmName || 'Unnamed Farm',
			fullName: doc.data().fullName,
			email: doc.data().email
		}));
		
		return json(farms);
	} catch (error) {
		console.error('Error fetching farms:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
