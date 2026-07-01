import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { userId, status, rejectionReason } = body;

		if (!userId || typeof userId !== 'string') {
			return json({ error: 'User ID is required' }, { status: 400 });
		}

		if (!status || !['Verified', 'Rejected', 'Pending'].includes(status)) {
			return json({ error: 'Valid status (Verified, Rejected, Pending) is required' }, { status: 400 });
		}

		const userRef = adminDb.collection('users').doc(userId);
		const userDoc = await userRef.get();

		if (!userDoc.exists) {
			return json({ error: 'User profile not found' }, { status: 404 });
		}

		const userData = userDoc.data();
		const role = userData.role || 'farmer';

		const updatePayload = {
			verificationStatus: status,
			verified: status === 'Verified',
			verifiedAt: status === 'Verified' ? new Date().toISOString() : null,
			verifiedBy: status === 'Verified' ? locals.user.uid : null,
			rejectionReason: status === 'Rejected' ? (rejectionReason || 'No reason provided') : null,
			rejectedAt: status === 'Rejected' ? new Date().toISOString() : null,
			rejectedBy: status === 'Rejected' ? locals.user.uid : null
		};

		await userRef.update(updatePayload);

		// Generate notification for the user
		await adminDb.collection('notifications').add({
			title: status === 'Verified' ? 'Profile Verified Successfully!' : 'Profile Verification Rejected',
			message: status === 'Verified' 
				? 'Congratulations! Your profile has been approved. You now have full access to marketplace listings and reports.' 
				: `Your profile verification was rejected. Reason: ${rejectionReason || 'No reason provided'}. Please edit your details and resubmit.`,
			read: false,
			type: 'system',
			userId: userId,
			createdAt: new Date().toISOString()
		});

		// Record admin action to system logs
		await adminDb.collection('system_logs').add({
			title: `Profile ${status}: ${userData.fullName || 'User'}`,
			userName: locals.profile.fullName || 'Admin',
			userEmail: locals.profile.email || 'admin@agriconnect.com',
			status: status.toLowerCase(),
			createdAt: new Date().toISOString()
		});

		return json({ success: true, message: `User profile status updated to ${status} successfully` });
	} catch (error) {
		console.error('Error verifying user profile:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
