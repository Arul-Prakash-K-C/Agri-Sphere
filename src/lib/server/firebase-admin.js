import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

function getFirebaseAdminApp() {
	if (getApps().length > 0) {
		return getApp();
	}
	
	const options = {};
	try {
		if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
			let rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
			const firstBrace = rawKey.indexOf('{');
			const lastBrace = rawKey.lastIndexOf('}');
			if (firstBrace !== -1 && lastBrace !== -1) {
				rawKey = rawKey.substring(firstBrace, lastBrace + 1);
			}
			const serviceAccount = JSON.parse(rawKey);
			if (serviceAccount.private_key) {
				serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
			}
			options.credential = cert(serviceAccount);
		}
	} catch (error) {
		console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY. Admin SDK may not work.', error);
	}

	try {
		return initializeApp(options);
	} catch (err) {
		console.warn('Firebase admin initial initializeApp failed, attempting dummy project init for build safety.', err.message);
		return initializeApp({
			projectId: 'agri-sphere-fallback'
		});
	}
}

export const adminApp = getFirebaseAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
