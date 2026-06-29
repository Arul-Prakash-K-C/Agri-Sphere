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

		// Data cleanup: delete inventory items with no name
		const namelessItems = inventory.filter(item => !item.name || typeof item.name !== 'string' || item.name.trim() === '');
		if (namelessItems.length > 0) {
			const batch = adminDb.batch();
			namelessItems.forEach(item => {
				batch.delete(adminDb.collection('inventory').doc(item.id));
			});
			await batch.commit();
			inventory = inventory.filter(item => item.name && typeof item.name === 'string' && item.name.trim() !== '');
		}

		// Fetch storages
		const storagesSnapshot = await adminDb.collection('storages')
			.where('farmerId', '==', locals.user.uid)
			.get();
		let storages = storagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

		return json({ inventory, storages });
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

		if (action === 'update_stock') {
			const { itemId, total, soldUsed } = body;
			if (!itemId) {
				return json({ error: 'Item ID is required' }, { status: 400 });
			}

			const docRef = adminDb.collection('inventory').doc(itemId);
			const docSnap = await docRef.get();
			if (!docSnap.exists) {
				return json({ error: 'Item not found' }, { status: 404 });
			}
			if (docSnap.data().farmerId !== locals.user.uid) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			const updateObj = {};
			if (total !== undefined) updateObj.total = Number(total);
			if (soldUsed !== undefined) updateObj.soldUsed = Number(soldUsed);

			await docRef.update(updateObj);
			return json({ success: true, itemId, ...updateObj });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error updating inventory properties:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
