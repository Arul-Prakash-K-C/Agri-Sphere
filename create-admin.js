import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      // Remove surrounding quotes if any
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!rawKey) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env");
  process.exit(1);
}
if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
  rawKey = rawKey.slice(1, -1);
}
const serviceAccount = JSON.parse(rawKey);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  const email = 'admin01@gmail.com';
  const password = '123456';
  
  try {
    console.log(`Creating user in Firebase Auth: ${email}...`);
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`User already exists in Firebase Auth with UID: ${userRecord.uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: 'Admin User',
          emailVerified: true
        });
        console.log(`Successfully created new user in Firebase Auth with UID: ${userRecord.uid}`);
      } else {
        throw authErr;
      }
    }

    const uid = userRecord.uid;

    console.log(`Setting user document in Firestore users/${uid}...`);
    await db.collection('users').doc(uid).set({
      fullName: 'Admin User',
      email: email,
      role: 'admin',
      phone: '1234567890',
      createdAt: new Date().toISOString(),
      adminAccessCode: 'ADMIN01'
    });
    console.log(`Successfully set user document in Firestore!`);

    // Let's also check if mock local-db.json exists, and update it too just in case!
    const localDbPath = path.resolve(process.cwd(), 'local-db.json');
    if (fs.existsSync(localDbPath)) {
      try {
        const localDbContent = fs.readFileSync(localDbPath, 'utf-8');
        const localDb = JSON.parse(localDbContent || '{}');
        if (!localDb.users) localDb.users = {};
        localDb.users[uid] = {
          fullName: 'Admin User',
          email: email,
          role: 'admin',
          phone: '1234567890',
          createdAt: new Date().toISOString(),
          adminAccessCode: 'ADMIN01'
        };
        fs.writeFileSync(localDbPath, JSON.stringify(localDb, null, 2), 'utf-8');
        console.log(`Successfully added to local-db.json fallback database!`);
      } catch (dbErr) {
        console.error("Error writing to local-db.json:", dbErr.message);
      }
    }

    console.log('All admin initialization tasks completed successfully!');
  } catch (err) {
    console.error('Error initializing admin user:', err);
  }
}

run();
