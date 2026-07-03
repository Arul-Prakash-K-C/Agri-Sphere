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
		console.log(`Generating password reset link for: ${email}`);
		const link = await adminAuth.generatePasswordResetLink(email);
		console.log('\nSUCCESS! Use the link below to set your password directly:');
		console.log(link);
	} catch (err) {
		console.error('Error generating link:', err);
	}
	process.exit(0);
}

run();
