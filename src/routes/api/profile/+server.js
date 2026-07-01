import { json } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebase-admin';
import { deleteSessionCookie } from '$lib/server/cookies';

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { fullName, phone } = body;

		if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length === 0)) {
			return json({ error: 'Full name must be a non-empty string' }, { status: 400 });
		}
		if (phone !== undefined && typeof phone !== 'string') {
			return json({ error: 'Phone must be a string' }, { status: 400 });
		}

		const updatePayload = {};
		if (fullName !== undefined) updatePayload.fullName = fullName;
		if (phone !== undefined) updatePayload.phone = phone;

		// For farmers, let them also edit farmName, farmArea, address
		if (locals.profile?.role === 'farmer') {
			if (body.farmName !== undefined) updatePayload.farmName = body.farmName;
			if (body.farmArea !== undefined) updatePayload.farmArea = Number(body.farmArea);
			if (body.address !== undefined) updatePayload.address = body.address;
		} else if (locals.profile?.role === 'customer') {
			if (body.address !== undefined) updatePayload.address = body.address;
		}

		await adminDb.collection('users').doc(locals.user.uid).update(updatePayload);

		const updatedDoc = await adminDb.collection('users').doc(locals.user.uid).get();
		return json({ success: true, profile: { id: updatedDoc.id, ...updatedDoc.data() } });
	} catch (error) {
		console.error('Error updating user profile:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ locals, cookies }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const uid = locals.user.uid;

		// 1. Delete user profile from Firestore
		await adminDb.collection('users').doc(uid).delete();

		// 2. Delete Auth account via Firebase Admin SDK (prevents reauth block)
		await adminAuth.deleteUser(uid);

		// 3. Clear session cookies
		deleteSessionCookie(cookies);

		return json({ success: true, message: 'Account deleted successfully' });
	} catch (error) {
		console.error('Error deleting user account:', error);
		return json({ error: error.message || 'Failed to delete account' }, { status: 500 });
	}
}
