import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

let adminAuth;
let adminDb;

if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
	// Standard Admin SDK initialization when Service Account Key is provided
	const { initializeApp, cert, getApps } = await import('firebase-admin/app');
	const { getAuth } = await import('firebase-admin/auth');
	const { getFirestore } = await import('firebase-admin/firestore');

	let rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
	rawKey = rawKey.replace(/^['"]|['"]$/g, '');
	
	const firstBrace = rawKey.indexOf('{');
	const lastBrace = rawKey.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		rawKey = rawKey.substring(firstBrace, lastBrace + 1);
	}
	
	let serviceAccount;
	try {
		serviceAccount = JSON.parse(rawKey);
	} catch (err) {
		console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', err.message);
		throw err;
	}
	if (serviceAccount.private_key) {
		serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
	}

	const apps = getApps();
	const adminApp = apps.length > 0 ? apps[0] : initializeApp({
		credential: cert(serviceAccount)
	});

	adminAuth = getAuth(adminApp);
	adminDb = getFirestore(adminApp);
} else {
	// Fallback/Mock Mode using a local JSON database for Firestore
	console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY is not configured in env.');
	console.warn('🔌 Initializing local JSON database and mock Auth for development...');

	class MockDocumentSnapshot {
		constructor(id, data) {
			this.id = id;
			this._data = data;
			this.exists = data !== undefined && data !== null;
		}
		data() {
			return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
		}
	}

	class MockQuerySnapshot {
		constructor(docs) {
			this.docs = docs;
			this.size = docs.length;
		}
		forEach(callback) {
			this.docs.forEach(callback);
		}
	}

	class MockDocRef {
		constructor(collectionRef, id) {
			this.collectionRef = collectionRef;
			this.id = id;
		}

		async get() {
			const data = this.collectionRef.dbInstance.readDoc(this.collectionRef.name, this.id);
			return new MockDocumentSnapshot(this.id, data);
		}

		async set(data) {
			this.collectionRef.dbInstance.writeDoc(this.collectionRef.name, this.id, data);
			return { writeTime: new Date() };
		}

		async update(data) {
			this.collectionRef.dbInstance.updateDoc(this.collectionRef.name, this.id, data);
			return { writeTime: new Date() };
		}

		async delete() {
			this.collectionRef.dbInstance.deleteDoc(this.collectionRef.name, this.id);
			return { writeTime: new Date() };
		}
	}

	class MockQuery {
		constructor(collectionRef, filters = [], limitVal = null) {
			this.collectionRef = collectionRef;
			this.filters = filters;
			this.limitVal = limitVal;
		}

		where(field, op, val) {
			return new MockQuery(this.collectionRef, [...this.filters, { field, op, val }], this.limitVal);
		}

		limit(n) {
			return new MockQuery(this.collectionRef, this.filters, n);
		}

		async get() {
			let docs = this.collectionRef.dbInstance.readCollection(this.collectionRef.name);
			
			// Apply filters
			for (const filter of this.filters) {
				docs = docs.filter(doc => {
					const fieldValue = doc[filter.field];
					const targetValue = filter.val;
					if (filter.op === '==' || filter.op === '===') {
						return fieldValue === targetValue;
					}
					if (filter.op === '!=') {
						return fieldValue !== targetValue;
					}
					if (filter.op === '>') {
						return fieldValue > targetValue;
					}
					if (filter.op === '>=') {
						return fieldValue >= targetValue;
					}
					if (filter.op === '<') {
						return fieldValue < targetValue;
					}
					if (filter.op === '<=') {
						return fieldValue <= targetValue;
					}
					return false;
				});
			}

			if (this.limitVal !== null) {
				docs = docs.slice(0, this.limitVal);
			}

			const snapshots = docs.map(d => new MockDocumentSnapshot(d.id, d));
			return new MockQuerySnapshot(snapshots);
		}
	}

	class MockCollectionRef {
		constructor(dbInstance, name) {
			this.dbInstance = dbInstance;
			this.name = name;
		}

		doc(id) {
			const docId = id || Math.random().toString(36).substring(2, 15);
			return new MockDocRef(this, docId);
		}

		where(field, op, val) {
			return new MockQuery(this).where(field, op, val);
		}

		limit(n) {
			return new MockQuery(this).limit(n);
		}

		async add(data) {
			const id = Math.random().toString(36).substring(2, 15);
			const docData = { id, ...data };
			this.dbInstance.writeDoc(this.name, id, docData);
			return new MockDocRef(this, id);
		}

		async get() {
			return new MockQuery(this).get();
		}
	}

	class MockBatch {
		constructor(dbInstance) {
			this.dbInstance = dbInstance;
			this.ops = [];
		}

		set(docRef, data) {
			this.ops.push({ type: 'set', ref: docRef, data });
			return this;
		}

		update(docRef, data) {
			this.ops.push({ type: 'update', ref: docRef, data });
			return this;
		}

		delete(docRef) {
			this.ops.push({ type: 'delete', ref: docRef });
			return this;
		}

		async commit() {
			for (const op of this.ops) {
				const colName = op.ref.collectionRef.name;
				const docId = op.ref.id;
				if (op.type === 'set') {
					this.dbInstance.writeDoc(colName, docId, op.data);
				} else if (op.type === 'update') {
					this.dbInstance.updateDoc(colName, docId, op.data);
				} else if (op.type === 'delete') {
					this.dbInstance.deleteDoc(colName, docId);
				}
			}
		}
	}

	class MockFirestore {
		constructor(filePath) {
			this.filePath = filePath;
			this.ensureFile();
		}

		ensureFile() {
			try {
				if (!fs.existsSync(this.filePath)) {
					fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
					fs.writeFileSync(this.filePath, JSON.stringify({}), 'utf-8');
				}
			} catch (e) {
				console.error('MockFirestore failed to ensure file:', e);
			}
		}

		readAll() {
			try {
				this.ensureFile();
				const content = fs.readFileSync(this.filePath, 'utf-8');
				return JSON.parse(content || '{}');
			} catch (e) {
				return {};
			}
		}

		writeAll(data) {
			try {
				fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
			} catch (e) {
				console.error('MockFirestore write error:', e);
			}
		}

		readCollection(colName) {
			const data = this.readAll();
			const col = data[colName] || {};
			return Object.keys(col).map(id => ({ id, ...col[id] }));
		}

		readDoc(colName, docId) {
			const data = this.readAll();
			return data[colName]?.[docId];
		}

		writeDoc(colName, docId, docData) {
			const data = this.readAll();
			if (!data[colName]) data[colName] = {};
			data[colName][docId] = { ...docData };
			this.writeAll(data);
		}

		updateDoc(colName, docId, docData) {
			const data = this.readAll();
			if (!data[colName]) data[colName] = {};
			const existing = data[colName][docId] || {};
			data[colName][docId] = { ...existing, ...docData };
			this.writeAll(data);
		}

		deleteDoc(colName, docId) {
			const data = this.readAll();
			if (data[colName] && data[colName][docId]) {
				delete data[colName][docId];
				this.writeAll(data);
			}
		}

		collection(name) {
			return new MockCollectionRef(this, name);
		}

		batch() {
			return new MockBatch(this);
		}
	}

	const dbPath = path.resolve(process.cwd(), 'local-db.json');
	adminDb = new MockFirestore(dbPath);

	// Mock Auth SDK using standard JWT decoding
	adminAuth = {
		verifyIdToken: async (idToken) => {
			try {
				const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8'));
				return {
					uid: payload.user_id || payload.sub || payload.uid,
					email: payload.email,
					name: payload.name || payload.email?.split('@')[0] || 'User',
					...payload
				};
			} catch (err) {
				console.error('Error decoding ID token:', err);
				throw new Error('Invalid token format');
			}
		},
		createSessionCookie: async (idToken) => {
			return idToken;
		},
		verifySessionCookie: async (sessionCookie, checkRevoked = false) => {
			try {
				const payload = JSON.parse(Buffer.from(sessionCookie.split('.')[1], 'base64').toString('utf-8'));
				return {
					uid: payload.user_id || payload.sub || payload.uid,
					email: payload.email,
					name: payload.name || payload.email?.split('@')[0] || 'User',
					...payload
				};
			} catch (err) {
				console.error('Error decoding session cookie:', err);
				throw new Error('Invalid session cookie');
			}
		}
	};
}

export { adminAuth, adminDb };

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
