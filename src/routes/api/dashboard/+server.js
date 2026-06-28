import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user || !locals.profile) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { uid } = locals.user;
	const { role } = locals.profile;

	try {
		if (role === 'farmer') {
			// Query Farmer Crops, Expenses, Inventory, and Settings concurrently
			const [cropsSnapshot, expensesSnapshot, inventorySnapshot, settingsDoc] = await Promise.all([
				adminDb.collection('crops').where('farmerId', '==', uid).get(),
				adminDb.collection('expenses').where('farmerId', '==', uid).get(),
				adminDb.collection('inventory').where('farmerId', '==', uid).get(),
				adminDb.collection('inventory_settings').doc(uid).get()
			]);

			let crops = cropsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			let expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			let inventory = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			let settings = { silo1: 0, silo2: 0, coldStorage: 0 };
			if (settingsDoc.exists) {
				settings = settingsDoc.data();
			} else {
				await adminDb.collection('inventory_settings').doc(uid).set(settings);
			}

			return json({
				crops,
				expenses,
				inventory,
				settings,
				weather: {
					temp: 32,
					humidity: 45,
					windSpeed: 12,
					soilMoisture: 'Optimal'
				}
			});
		}

		if (role === 'customer') {
			// Query Marketplace Produce (Products listed by farmers)
			let produceSnapshot = await adminDb.collection('products').get();
			
			// Seed marketplace products if empty
			if (produceSnapshot.empty) {
				const seedProducts = [
					{
						name: 'Sweet Corn',
						category: 'Vegetables',
						price: '₹1,800 / Qtl',
						size: '50 Quintals',
						description: 'Fresh organic sweet corn harvested from field Block A.',
						imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d20f6?auto=format&fit=crop&w=400&q=80',
						farmerId: 'seed-farmer-1',
						farmerName: 'Ramesh Kumar',
						status: 'Available',
						createdAt: new Date().toISOString()
					},
					{
						name: 'Winter Wheat',
						category: 'Grains',
						price: '₹2,400 / Qtl',
						size: '120 Quintals',
						description: 'High-quality winter wheat ready for direct shipping.',
						imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
						farmerId: 'seed-farmer-2',
						farmerName: 'Surinder Singh',
						status: 'Available',
						createdAt: new Date().toISOString()
					},
					{
						name: 'Organic Soybeans',
						category: 'Grains',
						price: '₹4,100 / Qtl',
						size: '75 Quintals',
						description: 'Non-GMO organic soybeans from valley sector 3.',
						imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80',
						farmerId: 'seed-farmer-3',
						farmerName: 'Vikas Patil',
						status: 'Available',
						createdAt: new Date().toISOString()
					}
				];

				for (const item of seedProducts) {
					await adminDb.collection('products').add(item);
				}
				produceSnapshot = await adminDb.collection('products').get();
			}

			// Gather all farmerIds to fetch profiles in parallel/batch
			const farmerIds = new Set();
			produceSnapshot.docs.forEach(doc => {
				const id = doc.data().farmerId;
				if (id) farmerIds.add(id);
			});

			const farmerProfiles = {};
			if (farmerIds.size > 0) {
				const idsArray = Array.from(farmerIds);
				// Fetch profiles in chunks of 10 to avoid Firestore limits
				const chunkSize = 10;
				for (let i = 0; i < idsArray.length; i += chunkSize) {
					const chunk = idsArray.slice(i, i + chunkSize);
					const snapshot = await adminDb.collection('users')
						.where('__name__', 'in', chunk)
						.get();
					snapshot.docs.forEach(doc => {
						farmerProfiles[doc.id] = doc.data();
					});
				}
			}

			const produce = [];
			for (const doc of produceSnapshot.docs) {
				const prodData = doc.data();
				
				// Only show available listings to customers
				if (prodData.status !== 'Available') continue;

				const fData = prodData.farmerId ? farmerProfiles[prodData.farmerId] : null;

				let farmerName = prodData.farmerName || (fData ? fData.fullName : 'Verified Farmer');
				let farmerPhone = fData ? fData.phone : '+919876543210';
				let farmerEmail = fData ? fData.email : 'farmer@agriconnect.com';
				let farmName = fData ? fData.farmName : 'Local Family Farm';
				let location = fData ? fData.address : (prodData.location || 'Local Fields');

				produce.push({
					id: doc.id,
					...prodData,
					farmer: farmerName,
					farmerName,
					farmerPhone,
					farmerEmail,
					farmName,
					location,
					farmLocation: location,
					plantedDate: prodData.createdAt ? new Date(prodData.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently Harvested',
					progress: 100, // listed products are harvest-ready
					stage: 'Harvest-Ready',
					stageColor: 'bg-emerald-50 text-dark-green border-emerald-100/50',
					statusDot: 'bg-primary-green'
				});
			}

			// Query Customer Orders / Contracts
			const ordersSnapshot = await adminDb.collection('orders')
				.where('customerId', '==', uid)
				.get();
			
			let orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Auto-seed customer orders if empty
			if (orders.length === 0) {
				const seedOrders = [
					{
						cropName: 'Organic Maize',
						farmerName: 'Surinder Singh',
						quantity: '100 Quintals',
						amount: 180000,
						status: 'In Transit',
						progress: 80,
						customerId: uid,
						createdAt: new Date().toISOString()
					},
					{
						cropName: 'Winter Wheat',
						farmerName: 'Surinder Singh',
						quantity: '140 Tons',
						amount: 245000,
						status: 'Delivered',
						progress: 100,
						customerId: uid,
						createdAt: new Date().toISOString()
					}
				];

				for (const item of seedOrders) {
					const docRef = await adminDb.collection('orders').add(item);
					orders.push({ id: docRef.id, ...item });
				}
			}

			return json({
				produce,
				orders
			});
		}

		if (role === 'admin') {
			// Query all users to count and break down roles
			const usersSnapshot = await adminDb.collection('users').get();
			const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Migrate database entries from legacy 'buyer' role to 'customer'
			let migratedCount = 0;
			for (const u of users) {
				if (u.role === 'buyer') {
					await adminDb.collection('users').doc(u.id).update({ role: 'customer' });
					u.role = 'customer';
					migratedCount++;
				}
			}
			if (migratedCount > 0) {
				console.log(`Migrated ${migratedCount} legacy buyer profiles to customer.`);
			}

			// Seed a couple of system activity logs if logs are empty (for premium look)
			const logsSnapshot = await adminDb.collection('system_logs')
				.limit(10)
				.get();
			
			let logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			if (logs.length === 0) {
				const seedLogs = [
					{
						title: 'New Farmer Registration',
						userName: 'Ramesh Kumar',
						userEmail: 'ramesh@example.com',
						status: 'completed',
						createdAt: new Date().toISOString()
					},
					{
						title: 'Escrow Account Verified',
						userName: 'Asha Sharma',
						userEmail: 'asha@example.com',
						status: 'active',
						createdAt: new Date().toISOString()
					}
				];

				for (const log of seedLogs) {
					const docRef = await adminDb.collection('system_logs').add(log);
					logs.push({ id: docRef.id, ...log });
				}
			}

			return json({
				users,
				logs
			});
		}

		return json({ error: 'Invalid user role' }, { status: 400 });
	} catch (error) {
		console.error('Error fetching dashboard statistics:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
