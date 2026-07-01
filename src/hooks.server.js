import { redirect } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebase-admin';
import { getSessionCookie, deleteSessionCookie } from '$lib/server/cookies';

const VALID_ROLES = ['admin', 'farmer', 'customer'];

function homeForRole(role) {
	if (role === 'admin') return '/admin/dashboard';
	if (role === 'farmer') return '/farmer/dashboard';
	if (role === 'customer') return '/customer/dashboard';
	return '/login';
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const sessionCookie = getSessionCookie(event.cookies);
	const path = event.url.pathname;

	let user = null;
	let profile = null;

	if (sessionCookie) {
		try {
			// Verify session cookie securely (using local signature verification without blocking network calls to Firebase)
			const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false);
			user = decodedClaims;

			// Fetch the user's profile from Firestore to get their role securely
			const userDoc = await adminDb.collection('users').doc(user.uid).get();
			if (userDoc.exists) {
				profile = { id: userDoc.id, ...userDoc.data() };
			}

			// If role is invalid, clean up session
			if (profile && !VALID_ROLES.includes(profile.role)) {
				profile = null;
				deleteSessionCookie(event.cookies);
			}
		} catch (error) {
			console.error('Error verifying session cookie:', error);
			deleteSessionCookie(event.cookies);
		}
	}

	event.locals.user = user;
	event.locals.profile = profile;

	const role = profile?.role;

	const isProtectedRoute = path.startsWith('/admin') || path.startsWith('/farmer') || path.startsWith('/customer');

	if (isProtectedRoute) {
		if (!user || !profile) {
			redirect(303, '/login');
		}

		if (path.startsWith('/admin') && role !== 'admin') {
			redirect(303, homeForRole(role));
		}

		if (path.startsWith('/farmer') && role !== 'farmer') {
			redirect(303, homeForRole(role));
		}

		if (path.startsWith('/customer') && role !== 'customer') {
			redirect(303, homeForRole(role));
		}
	}

	const isGuestRoute = path === '/' || path === '/login' || path === '/signup' || path === '/forgot-password';
	if (isGuestRoute && user && profile) {
		redirect(303, homeForRole(role));
	}

	return resolve(event);
}
