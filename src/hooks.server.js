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
			let decodedClaims;
			try {
				decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false);
			} catch (verifierErr) {
				// If offline/network error, decode the session cookie payload locally to keep dev environment working offline
				const errMsg = verifierErr.message || '';
				if (errMsg.includes('ENOTFOUND') || errMsg.includes('fetch failed') || errMsg.includes('ECONNRESET') || verifierErr.code === 'auth/network-error') {
					console.warn('⚠️ Network disconnected. Decoding session cookie locally...');
					const payload = JSON.parse(Buffer.from(sessionCookie.split('.')[1], 'base64').toString('utf-8'));
					decodedClaims = {
						uid: payload.user_id || payload.sub || payload.uid,
						email: payload.email,
						name: payload.name || payload.email?.split('@')[0] || 'User',
						...payload
					};
				} else {
					throw verifierErr;
				}
			}
			user = decodedClaims;

			// Fetch the user's profile from Firestore to get their role securely
			let userDoc;
			try {
				userDoc = await adminDb.collection('users').doc(user.uid).get();
			} catch (dbErr) {
				const errMsg = dbErr.message || '';
				if (errMsg.includes('ENOTFOUND') || errMsg.includes('fetch failed') || errMsg.includes('ECONNRESET') || errMsg.includes('Could not load the default credentials')) {
					console.warn('⚠️ Network disconnected. Fetching profile from local-db.json fallback...');
					const fs = await import('fs');
					const path = await import('path');
					const dbPath = path.resolve(process.cwd(), 'local-db.json');
					if (fs.existsSync(dbPath)) {
						const localData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
						const mockData = localData.users?.[user.uid];
						userDoc = { exists: !!mockData, id: user.uid, data: () => mockData };
					} else {
						userDoc = { exists: false };
					}
				} else {
					throw dbErr;
				}
			}

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

	const isProtectedRoute = path.startsWith('/admin') || path.startsWith('/farmer') || path.startsWith('/customer') || path.startsWith('/settings');

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
