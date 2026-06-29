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

export async function syncInventoryForFarmer(farmerId) {
	// 1. Fetch harvests
	const harvestsSnapshot = await adminDb.collection('harvests')
		.where('farmerId', '==', farmerId)
		.get();
	const harvests = harvestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

	// Sort chronologically to simulate sequential additions
	harvests.sort((a, b) => {
		return (a.createdAt || a.harvestDate || '').localeCompare(b.createdAt || b.harvestDate || '');
	});

	// Helper for unit conversion
	function convertToUnit(amount, fromUnit, toUnit) {
		if (!amount || isNaN(amount)) return 0;
		const from = (fromUnit || '').trim().toLowerCase();
		const to = (toUnit || '').trim().toLowerCase();
		if (from === to) return amount;
		
		if (from === 'kg' && to === 'tons') return amount / 1000;
		if (from === 'tons' && to === 'kg') return amount * 1000;
		if (from === 'g' && to === 'kg') return amount / 1000;
		if (from === 'kg' && to === 'g') return amount * 1000;
		if (from === 'ml' && to === 'liters') return amount / 1000;
		if (from === 'liters' && to === 'ml') return amount * 1000;

		return amount;
	}

	function cleanProductName(name) {
		return (name || '').replace(/\s+Harvest$/i, '').trim().toLowerCase();
	}

	function getExpiryDateStr(harvestDateStr, lifespanStr) {
		if (!harvestDateStr || !lifespanStr) return '';
		const match = lifespanStr.match(/(\d+)/);
		if (!match) return '';
		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(harvestDateStr + 'T00:00:00Z');
		const expiry = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		return expiry.toISOString().split('T')[0];
	}

	function calculateRemainingLife(harvestDateStr, lifespanStr) {
		if (!harvestDateStr || !lifespanStr) return null;
		const match = lifespanStr.match(/(\d+)/);
		if (!match) return null;
		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(harvestDateStr + 'T00:00:00');
		const expiry = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffMs = expiry.getTime() - today.getTime();
		return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	}

	// 2. Fetch existing inventory docs
	const inventorySnapshot = await adminDb.collection('inventory')
		.where('farmerId', '==', farmerId)
		.get();
	const inventoryItems = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

	const now = new Date().toISOString();

	// 3. Sequentially build aggregated inventory batches
	const inventoryBatches = [];

	for (const h of harvests) {
		if (h.status === 'sold' || h.status === 'Sold') continue;

		const cropName = (h.cropName || '').trim();
		const category = (h.category || 'Vegetables').trim();
		const grade = (h.qualityGrade || 'Grade A').trim();
		const lifespan = (h.lifespan || '').trim();
		const remainingLife = calculateRemainingLife(h.harvestDate, lifespan);
		const storageId = (h.storageId || '').trim();
		const unit = h.unit || 'Liters';

		// Match existing built batches
		const matched = inventoryBatches.find(inv => {
			const nameMatch = cleanProductName(inv.cropName) === cleanProductName(cropName);
			const catMatch = (inv.category || '').trim().toLowerCase() === category.toLowerCase();
			const gradeMatch = (inv.grade || '').trim().toLowerCase() === grade.toLowerCase();
			const lifeMatch = inv.remainingLife === remainingLife;
			const storageMatch = (inv.storageId || '') === storageId;
			const statusMatch = inv.status !== 'sold' && ((inv.total || 0) - (inv.soldUsed || 0) > 0.001);
			const notExpired = remainingLife !== null && remainingLife > 0;

			return nameMatch && catMatch && gradeMatch && lifeMatch && storageMatch && statusMatch && notExpired;
		});

		if (matched) {
			const qtyInInvUnit = convertToUnit(Number(h.quantity || 0), h.unit, matched.unit);
			const soldInInvUnit = convertToUnit(Number(h.soldUsed || 0), h.unit, matched.unit);
			matched.total += qtyInInvUnit + soldInInvUnit;
			matched.soldUsed += soldInInvUnit;
			if (h.id && !matched.harvestIds.includes(h.id)) {
				matched.harvestIds.push(h.id);
			}
			if (h.createdAt && h.createdAt < matched.createdAt) {
				matched.createdAt = h.createdAt;
			}
		} else {
			// Find if there's an existing unused inventory item to reuse its ID
			const matchedExisting = inventoryItems.find(item => {
				const isUnused = !inventoryBatches.some(b => b.id === item.id);
				if (!isUnused) return false;
				
				const nameMatch = cleanProductName(item.cropName) === cleanProductName(cropName) || cleanProductName(item.name) === cleanProductName(cropName);
				const catMatch = (item.category || '').trim().toLowerCase() === category.toLowerCase();
				const gradeMatch = (item.grade || '').trim().toLowerCase() === grade.toLowerCase();
				const lifeMatch = item.remainingLife === remainingLife;
				const storageMatch = (item.storageId || '') === storageId;
				const statusMatch = item.status !== 'sold' && ((item.total || 0) - (item.soldUsed || 0) > 0.001);

				return nameMatch && catMatch && gradeMatch && lifeMatch && storageMatch && statusMatch;
			});

			const docId = matchedExisting ? matchedExisting.id : adminDb.collection('inventory').doc().id;

			inventoryBatches.push({
				id: docId,
				isNew: !matchedExisting,
				name: cropName + ' Harvest',
				cropName: cropName,
				category: category,
				grade: grade,
				lifespan: lifespan,
				remainingLife: remainingLife,
				storageId: storageId,
				unit: unit,
				total: Number(h.quantity || 0) + Number(h.soldUsed || 0),
				soldUsed: Number(h.soldUsed || 0),
				harvestIds: [h.id],
				farmerId,
				createdAt: h.createdAt || now
			});
		}
	}

	// 6. Commit all updates, creations, deletions to database
	const batch = adminDb.batch();
	const usedInvIds = new Set(inventoryBatches.map(b => b.id));

	for (const inv of inventoryBatches) {
		const invRef = adminDb.collection('inventory').doc(inv.id);
		const roundedSoldUsed = Math.round(inv.soldUsed * 1000) / 1000;
		const isSold = (inv.total - roundedSoldUsed) <= 0.001;
		
		const invData = {
			name: inv.name,
			cropName: inv.cropName,
			category: inv.category,
			total: inv.total,
			soldUsed: roundedSoldUsed,
			unit: inv.unit,
			grade: inv.grade,
			lifespan: inv.lifespan,
			remainingLife: inv.remainingLife,
			harvestIds: inv.harvestIds,
			farmerId: inv.farmerId,
			storageId: inv.storageId,
			status: isSold ? 'sold' : 'Available',
			updatedAt: now
		};

		if (inv.isNew) {
			batch.set(invRef, {
				...invData,
				icon: 'inventory_2',
				progress: 100,
				statusColor: 'bg-emerald-50 text-dark-green border-emerald-100/50',
				createdAt: inv.createdAt
			});
		} else {
			batch.update(invRef, invData);
		}

		for (const hId of inv.harvestIds) {
			const hRef = adminDb.collection('harvests').doc(hId);
			batch.update(hRef, { status: isSold ? 'sold' : '' });
		}
	}

	// Delete obsolete inventory docs
	for (const item of inventoryItems) {
		const isUnused = !usedInvIds.has(item.id);
		const isHarvestSource = item.sourceType === 'harvest' || (item.harvestIds && item.harvestIds.length > 0) || !item.sourceType;
		if (isUnused && isHarvestSource) {
			batch.delete(adminDb.collection('inventory').doc(item.id));
		}
	}

	await batch.commit();
}

export async function upsertInventoryFromHarvest(farmerId, harvest) {
	await syncInventoryForFarmer(farmerId);
}

