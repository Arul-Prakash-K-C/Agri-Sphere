import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const farmerId = url.searchParams.get('farmerId');
		let query = adminDb.collection('products');

		if (farmerId) {
			query = query.where('farmerId', '==', farmerId);
		}

		const snapshot = await query.get();
		let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Seed marketplace products if empty
		if (products.length === 0 && !farmerId) {
			const seedProducts = [
				{
					name: 'Sweet Corn',
					category: 'Vegetables',
					price: '1,800',
					quantity: 50,
					unit: 'Tons',
					harvestDate: 'Jun 10, 2026',
					farmLocation: 'Field Block A, Punjab',
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
					price: '2,400',
					quantity: 120,
					unit: 'Tons',
					harvestDate: 'May 20, 2026',
					farmLocation: 'North Plateau, Haryana',
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
					price: '4,100',
					quantity: 75,
					unit: 'Tons',
					harvestDate: 'Jun 15, 2026',
					farmLocation: 'Valley Sector 3, Maharashtra',
					description: 'Non-GMO organic soybeans from valley sector 3.',
					imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80',
					farmerId: 'seed-farmer-3',
					farmerName: 'Vikas Patil',
					status: 'Available',
					createdAt: new Date().toISOString()
				}
			];

			for (const item of seedProducts) {
				const docRef = await adminDb.collection('products').add(item);
				products.push({ id: docRef.id, ...item });
			}
		}

		return json(products);
	} catch (error) {
		console.error('Error fetching products:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { name, category, price, quantity, unit, harvestDate, description, imageUrl, farmLocation } = body;

		// Manual Validation
		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: 'Product name is required' }, { status: 400 });
		}
		if (!price || typeof price !== 'string' || price.trim().length === 0) {
			return json({ error: 'Price specification is required' }, { status: 400 });
		}
		if (quantity === undefined || isNaN(Number(quantity)) || Number(quantity) <= 0) {
			return json({ error: 'Valid quantity greater than 0 is required' }, { status: 400 });
		}
		if (!unit || typeof unit !== 'string' || unit.trim().length === 0) {
			return json({ error: 'Unit specification is required' }, { status: 400 });
		}

		const newProduct = {
			name,
			category: category || 'Vegetables',
			price,
			quantity: Number(quantity),
			unit,
			harvestDate: harvestDate || 'Recently Harvested',
			description: description || '',
			imageUrl: imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
			farmLocation: farmLocation || locals.profile?.address || 'Local Fields',
			farmerId: locals.user.uid,
			farmerName: locals.profile?.fullName || 'Farmer',
			status: 'Available',
			createdAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('products').add(newProduct);

		// Seed initial price history record
		adminDb.collection('priceHistory').add({
			productId: docRef.id,
			price: newProduct.price,
			updatedAt: new Date().toISOString()
		}).catch(err => console.error('Error seeding initial price history:', err));

		await adminDb.collection('notifications').add({
			title: 'Product Listed',
			message: `Product "${name}" has been listed in the marketplace for ₹${price}/${unit}.`,
			read: false,
			type: 'marketplace',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ id: docRef.id, ...newProduct }, { status: 201 });
	} catch (error) {
		console.error('Error creating product:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
