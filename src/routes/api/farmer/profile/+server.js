import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer' && locals.profile?.role !== 'manager') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const userDoc = await adminDb.collection('users').doc(locals.activeFarmerId).get();
		if (!userDoc.exists) {
			return json({ error: 'Profile not found' }, { status: 404 });
		}
		return json({ profile: { id: userDoc.id, ...userDoc.data() } });
	} catch (error) {
		console.error('Error fetching farmer profile:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { fullName, phone, farmName, farmArea, address } = body;

		// Manual Validation using JS if statements
		if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length === 0)) {
			return json({ error: 'Full name must be a non-empty string' }, { status: 400 });
		}
		if (phone !== undefined && typeof phone !== 'string') {
			return json({ error: 'Phone must be a string' }, { status: 400 });
		}
		if (farmName !== undefined && typeof farmName !== 'string') {
			return json({ error: 'Farm name must be a string' }, { status: 400 });
		}
		if (farmArea !== undefined && (isNaN(Number(farmArea)) || Number(farmArea) < 0)) {
			return json({ error: 'Farm area must be a valid positive number' }, { status: 400 });
		}
		if (address !== undefined && typeof address !== 'string') {
			return json({ error: 'Address must be a string' }, { status: 400 });
		}

		const updatePayload = {};
		if (fullName !== undefined) updatePayload.fullName = fullName;
		if (phone !== undefined) updatePayload.phone = phone;
		if (farmName !== undefined) updatePayload.farmName = farmName;
		if (farmArea !== undefined) updatePayload.farmArea = Number(farmArea);
		if (address !== undefined) updatePayload.address = address;

		await adminDb.collection('users').doc(locals.user.uid).update(updatePayload);

		// Get updated profile document
		const updatedDoc = await adminDb.collection('users').doc(locals.user.uid).get();
		return json({ success: true, profile: { id: updatedDoc.id, ...updatedDoc.data() } });
	} catch (error) {
		console.error('Error updating farmer profile:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
