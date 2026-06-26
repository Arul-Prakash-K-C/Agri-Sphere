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
			// Query Farmer Crops
			const cropsSnapshot = await adminDb.collection('crops')
				.where('farmerId', '==', uid)
				.get();
			
			let crops = cropsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Auto-seed farmer crops if empty
			if (crops.length === 0) {
				const seedCrops = [
					{
						name: 'Sweet Corn',
						location: 'Field Block A',
						stage: 'Vegetative Stage',
						stageColor: 'bg-emerald-50 text-dark-green border-emerald-100/50',
						statusDot: 'bg-primary-green',
						plantedDate: 'Apr 12',
						progress: 45,
						acres: 50,
						imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d20f6?auto=format&fit=crop&w=600&q=80',
						farmerId: uid,
						createdAt: new Date().toISOString()
					},
					{
						name: 'Winter Wheat',
						location: 'North Plateau',
						stage: 'Harvest-Ready',
						stageColor: 'bg-amber-50 text-amber-800 border-amber-100/50',
						statusDot: 'bg-amber-500',
						plantedDate: 'Oct 05',
						progress: 95,
						acres: 120,
						imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
						farmerId: uid,
						createdAt: new Date().toISOString()
					},
					{
						name: 'Organic Soybeans',
						location: 'Valley Section 3',
						stage: 'Flowering Stage',
						stageColor: 'bg-indigo-50 text-indigo-700 border-indigo-100/50',
						statusDot: 'bg-indigo-500',
						plantedDate: 'May 20',
						progress: 65,
						acres: 75,
						imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80',
						farmerId: uid,
						createdAt: new Date().toISOString()
					}
				];

				for (const item of seedCrops) {
					const docRef = await adminDb.collection('crops').add(item);
					crops.push({ id: docRef.id, ...item });
				}
			}

			// Query Farmer Expenses
			const expensesSnapshot = await adminDb.collection('expenses')
				.where('farmerId', '==', uid)
				.get();
			
			let expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Query Farmer Inventory
			const inventorySnapshot = await adminDb.collection('inventory')
				.where('farmerId', '==', uid)
				.get();
			
			let inventory = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Auto-seed inventory if empty
			if (inventory.length === 0) {
				const seedInventory = [
					{
						itemName: 'Premium Wheat Seeds',
						quantity: 1200,
						unit: 'kg',
						category: 'Seeds',
						farmerId: uid,
						createdAt: new Date().toISOString()
					},
					{
						itemName: 'NPK Nitrogen Fertilizer',
						quantity: 850,
						unit: 'kg',
						category: 'Fertilizer',
						farmerId: uid,
						createdAt: new Date().toISOString()
					},
					{
						itemName: 'Organic Pesticide Spray',
						quantity: 400,
						unit: 'liters',
						category: 'Chemicals',
						farmerId: uid,
						createdAt: new Date().toISOString()
					}
				];

				for (const item of seedInventory) {
					const docRef = await adminDb.collection('inventory').add(item);
					inventory.push({ id: docRef.id, ...item });
				}
			}

			return json({
				crops,
				expenses,
				inventory,
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

			const produce = [];
			for (const doc of produceSnapshot.docs) {
				const prodData = doc.data();
				
				// Only show available listings to customers
				if (prodData.status !== 'Available') continue;

				let farmerName = prodData.farmerName || 'Verified Farmer';
				let farmerPhone = '+919876543210';
				let farmerEmail = 'farmer@agriconnect.com';
				let farmName = 'Local Family Farm';
				let location = prodData.location || 'Local Fields';

				// Fetch farmer profile details from 'users' collection
				if (prodData.farmerId) {
					try {
						const farmerDoc = await adminDb.collection('users').doc(prodData.farmerId).get();
						if (farmerDoc.exists) {
							const fData = farmerDoc.data();
							farmerName = fData.fullName || farmerName;
							farmerPhone = fData.phone || farmerPhone;
							farmerEmail = fData.email || farmerEmail;
							farmName = fData.farmName || farmName;
							location = fData.address || location;
						}
					} catch (e) {
						console.error(`Error fetching farmer profile for product ${doc.id}:`, e);
					}
				}

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
