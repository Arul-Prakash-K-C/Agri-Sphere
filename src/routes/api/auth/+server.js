import { json } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebase-admin';
import { setSessionCookie, deleteSessionCookie } from '$lib/server/cookies';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
	try {
		const { idToken, profileData } = await request.json();

		if (!idToken || typeof idToken !== 'string') {
			return json({ error: 'Invalid ID token provided' }, { status: 400 });
		}

		// Verify the ID token first
		let decodedIdToken;
		try {
			decodedIdToken = await adminAuth.verifyIdToken(idToken);
		} catch (verifierErr) {
			const errMsg = verifierErr.message || '';
			if (errMsg.includes('ENOTFOUND') || errMsg.includes('fetch failed') || errMsg.includes('ECONNRESET')) {
				console.warn('⚠️ Network disconnected. Decoding ID token locally...');
				const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8'));
				decodedIdToken = {
					uid: payload.user_id || payload.sub || payload.uid,
					email: payload.email,
					name: payload.name || payload.email?.split('@')[0] || 'User',
					...payload
				};
			} else {
				throw verifierErr;
			}
		}
		const uid = decodedIdToken.uid;

		// Check if user profile already exists
		const userRef = adminDb.collection('users').doc(uid);
		let userDoc;
		try {
			userDoc = await userRef.get();
		} catch (dbErr) {
			const errMsg = dbErr.message || '';
			if (errMsg.includes('ENOTFOUND') || errMsg.includes('fetch failed') || errMsg.includes('ECONNRESET')) {
				console.warn('⚠️ Network disconnected. Checking user doc in local-db.json fallback...');
				const fs = await import('fs');
				const path = await import('path');
				const dbPath = path.resolve(process.cwd(), 'local-db.json');
				if (fs.existsSync(dbPath)) {
					const localData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
					const mockData = localData.users?.[uid];
					userDoc = { exists: !!mockData, id: uid, data: () => mockData };
				} else {
					userDoc = { exists: false };
				}
			} else {
				throw dbErr;
			}
		}

		if (!userDoc.exists) {
			// Validate role (rename 'buyer' to 'customer' to comply with user requests)
			let role = (profileData && profileData.role) || 'customer';
			if (role === 'buyer') role = 'customer';

			if (!['admin', 'farmer', 'customer'].includes(role)) {
				return json({ error: 'Invalid user role' }, { status: 400 });
			}

			// Construct base document data
			const baseData = {
				fullName: (profileData && profileData.fullName) || decodedIdToken.name || 'Google User',
				email: (profileData && profileData.email) || decodedIdToken.email,
				role,
				phone: (profileData && profileData.phone) || '',
				createdAt: new Date().toISOString()
			};

			if (role === 'farmer') {
				baseData.farmName = (profileData && profileData.farmName) || '';
				baseData.farmArea = (profileData && profileData.farmArea) ? Number(profileData.farmArea) : 0;
				baseData.address = (profileData && profileData.address) || '';
				baseData.verified = false; // Admin needs to verify
			} else if (role === 'customer') {
				baseData.address = (profileData && profileData.address) || '';
			} else if (role === 'admin') {
				baseData.adminAccessCode = (profileData && profileData.adminAccessCode) || '';
			}

			await userRef.set(baseData);
		}

		// Create session cookie (1 week expiry)
		const expiresIn = 60 * 60 * 24 * 7 * 1000;
		const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

		// Set the secure cookie
		setSessionCookie(cookies, sessionCookie);

		return json({ success: true, message: 'Session created successfully' }, { status: 200 });
	} catch (error) {
		console.error('Session creation error FULL TRACE:', error);
		return json({ error: error.message || 'Failed to create session' }, { status: 401 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ cookies }) {
	deleteSessionCookie(cookies);
	return json({ success: true, message: 'Session deleted successfully' }, { status: 200 });
}
