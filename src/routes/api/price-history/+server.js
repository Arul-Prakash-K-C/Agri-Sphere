import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const productId = url.searchParams.get('productId');

		if (!productId) {
			return json({ error: 'productId query parameter is required' }, { status: 400 });
		}

		const snapshot = await adminDb.collection('priceHistory')
			.where('productId', '==', productId)
			.get();

		let history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Sort by updatedAt ascending (client-side to avoid composite index)
		history.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

		return json(history);
	} catch (error) {
		console.error('Error fetching price history:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
