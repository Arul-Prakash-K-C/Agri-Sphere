import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const snapshot = await adminDb.collection('availabilitySubscriptions')
			.where('buyerId', '==', locals.user.uid)
			.get();

		const subscriptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		return json(subscriptions);
	} catch (error) {
		console.error('Error fetching availability subscriptions:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { productId } = body;

		if (!productId) {
			return json({ error: 'Product ID is required' }, { status: 400 });
		}

		// Prevent duplicate subscriptions
		const existing = await adminDb.collection('availabilitySubscriptions')
			.where('productId', '==', productId)
			.where('buyerId', '==', locals.user.uid)
			.get();

		if (!existing.empty) {
			return json({ error: 'Already subscribed', alreadySubscribed: true }, { status: 409 });
		}

		const subscription = {
			productId,
			buyerId: locals.user.uid,
			subscribedAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('availabilitySubscriptions').add(subscription);
		return json({ id: docRef.id, ...subscription }, { status: 201 });
	} catch (error) {
		console.error('Error creating availability subscription:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ url, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const productId = url.searchParams.get('productId');

		if (!productId) {
			return json({ error: 'Product ID query parameter is required' }, { status: 400 });
		}

		const snapshot = await adminDb.collection('availabilitySubscriptions')
			.where('productId', '==', productId)
			.where('buyerId', '==', locals.user.uid)
			.get();

		if (snapshot.empty) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		// Delete all matching subscription docs (should be 1)
		const batch = adminDb.batch();
		snapshot.docs.forEach(doc => batch.delete(doc.ref));
		await batch.commit();

		return json({ success: true, message: 'Unsubscribed successfully' });
	} catch (error) {
		console.error('Error deleting availability subscription:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
