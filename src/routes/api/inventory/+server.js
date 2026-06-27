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
		// Fetch inventory items
		const snapshot = await adminDb.collection('inventory')
			.where('farmerId', '==', locals.user.uid)
			.get();
		let inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Fetch storage settings doc (utilization)
		const settingsDoc = await adminDb.collection('inventory_settings')
			.doc(locals.user.uid)
			.get();

		let settings = { silo1: 45, silo2: 30, coldStorage: 60 };
		if (settingsDoc.exists) {
			settings = settingsDoc.data();
		} else {
			// Save default settings
			await adminDb.collection('inventory_settings').doc(locals.user.uid).set(settings);
		}

		return json({ inventory, settings });
	} catch (error) {
		console.error('Error fetching inventory details:', error);
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
		const { action } = body;

		if (action === 'update_settings') {
			const { silo1, silo2, coldStorage } = body;
			const settingsPayload = {
				silo1: Number(silo1),
				silo2: Number(silo2),
				coldStorage: Number(coldStorage),
				updatedAt: new Date().toISOString()
			};
			await adminDb.collection('inventory_settings').doc(locals.user.uid).set(settingsPayload, { merge: true });
			return json({ success: true, settings: settingsPayload });
		}

		if (action === 'update_unit') {
			const { itemId, unit } = body;
			if (!itemId || !unit) {
				return json({ error: 'Item ID and Unit are required' }, { status: 400 });
			}
			if (!['Kg', 'Tons', 'Liters'].includes(unit)) {
				return json({ error: 'Supported units: Kg, Tons, Liters' }, { status: 400 });
			}

			const docRef = adminDb.collection('inventory').doc(itemId);
			const docSnap = await docRef.get();
			if (!docSnap.exists) {
				return json({ error: 'Item not found' }, { status: 404 });
			}
			if (docSnap.data().farmerId !== locals.user.uid) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			await docRef.update({ unit });
			return json({ success: true, itemId, unit });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error updating inventory properties:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
