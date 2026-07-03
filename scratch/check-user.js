import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Load .env manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
	const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
	if (match) {
		let key = match[1];
		let value = match[2] || '';
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		} else if (value.startsWith("'") && value.endsWith("'")) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
});

let rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
const firstBrace = rawKey.indexOf('{');
const lastBrace = rawKey.lastIndexOf('}');
if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
	rawKey = rawKey.substring(firstBrace, lastBrace + 1);
}
const serviceAccount = JSON.parse(rawKey);
if (serviceAccount.private_key) {
	serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const app = initializeApp({
	credential: cert(serviceAccount)
});
const adminAuth = getAuth(app);

async function run() {
	try {
		const email = 'gmouly1@gmail.com';
		console.log(`Checking Firebase Auth user details for: ${email}`);
		try {
			const userRecord = await adminAuth.getUserByEmail(email);
			console.log('User found in Firebase Auth:');
			console.log('- UID:', userRecord.uid);
			console.log('- Provider Info:', userRecord.providerData.map(p => ({
				providerId: p.providerId,
				email: p.email,
				uid: p.uid
			})));
			console.log('- Email Verified:', userRecord.emailVerified);
			console.log('- Disabled:', userRecord.disabled);
		} catch (authErr) {
			if (authErr.code === 'auth/user-not-found') {
				console.log(`No user found in Firebase Auth for email: ${email}`);
			} else {
				console.error('Error fetching user from Firebase Auth:', authErr);
			}
		}
	} catch (err) {
		console.error('Script Error:', err);
	}
	process.exit(0);
}

run();
