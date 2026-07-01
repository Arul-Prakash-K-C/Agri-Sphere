import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const snapshot = await adminDb.collection('notifications')
			.where('userId', '==', locals.user.uid)
			.get();
		
		let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Seed initial notification if empty
		if (notifications.length === 0) {
			const seedNotifications = [
				{
					title: 'Welcome to AgriConnect!',
					message: 'Thank you for joining. Set up your profile to start managing your farm resources.',
					read: false,
					type: 'system',
					userId: locals.user.uid,
					createdAt: new Date().toISOString()
				}
			];

			for (const item of seedNotifications) {
				const docRef = await adminDb.collection('notifications').add(item);
				notifications.push({ id: docRef.id, ...item });
			}
		}

		notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return json(notifications);
	} catch (error) {
		console.error('Error fetching notifications:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { id, read, all } = body;

		if (all) {
			const snapshot = await adminDb.collection('notifications')
				.where('userId', '==', locals.user.uid)
				.where('read', '==', false)
				.get();
			
			const batch = adminDb.batch();
			snapshot.docs.forEach(doc => {
				batch.update(doc.ref, { read: true });
			});
			await batch.commit();

			return json({ success: true });
		}

		if (!id) {
			return json({ error: 'Notification ID is required' }, { status: 400 });
		}

		const docRef = adminDb.collection('notifications').doc(id);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Notification not found' }, { status: 404 });
		}

		if (docSnap.data().userId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.update({ read: !!read });
		const updatedDoc = await docRef.get();

		return json({ id: updatedDoc.id, ...updatedDoc.data() });
	} catch (error) {
		console.error('Error updating notification:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ url, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'Notification ID is required' }, { status: 400 });
		}

		const docRef = adminDb.collection('notifications').doc(id);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Notification not found' }, { status: 404 });
		}

		if (docSnap.data().userId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting notification:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

