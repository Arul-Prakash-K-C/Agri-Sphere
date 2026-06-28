import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'customer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('customer_settings').doc(locals.user.uid);
		const docSnap = await docRef.get();

		let settings = { wishlist: [], favoriteFarmers: [] };
		if (docSnap.exists) {
			settings = { ...settings, ...docSnap.data() };
		} else {
			await docRef.set(settings);
		}

		return json(settings);
	} catch (error) {
		console.error('Error fetching customer settings:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'customer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { action } = body;

		const docRef = adminDb.collection('customer_settings').doc(locals.user.uid);
		const docSnap = await docRef.get();

		let settings = { wishlist: [], favoriteFarmers: [] };
		if (docSnap.exists) {
			settings = { ...settings, ...docSnap.data() };
		}

		if (action === 'toggle_wishlist') {
			const { productId } = body;
			if (!productId) {
				return json({ error: 'Product ID is required' }, { status: 400 });
			}

			let wishlist = [...(settings.wishlist || [])];
			if (wishlist.includes(productId)) {
				wishlist = wishlist.filter(id => id !== productId);
			} else {
				wishlist.push(productId);
			}

			await docRef.set({ wishlist }, { merge: true });
			return json({ success: true, wishlist });
		}

		if (action === 'toggle_favorite_farmer') {
			const { farmerId } = body;
			if (!farmerId) {
				return json({ error: 'Farmer ID is required' }, { status: 400 });
			}

			let favoriteFarmers = [...(settings.favoriteFarmers || [])];
			if (favoriteFarmers.includes(farmerId)) {
				favoriteFarmers = favoriteFarmers.filter(id => id !== farmerId);
			} else {
				favoriteFarmers.push(farmerId);
			}

			await docRef.set({ favoriteFarmers }, { merge: true });
			return json({ success: true, favoriteFarmers });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error modifying customer settings:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
