import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const docRef = adminDb.collection('products').doc(params.id);
		const productDoc = await docRef.get();

		if (!productDoc.exists) {
			return json({ error: 'Product not found' }, { status: 404 });
		}

		return json({ id: productDoc.id, ...productDoc.data() });
	} catch (error) {
		console.error('Error fetching product details:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('products').doc(params.id);
		const productDoc = await docRef.get();

		if (!productDoc.exists) {
			return json({ error: 'Product not found' }, { status: 404 });
		}

		if (productDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { name, category, price, quantity, unit, harvestDate, description, imageUrl, farmLocation, status } = body;

		// Manual Validation
		if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
			return json({ error: 'Product name must be a non-empty string' }, { status: 400 });
		}
		if (price !== undefined && (typeof price !== 'string' || price.trim().length === 0)) {
			return json({ error: 'Price must be a non-empty string' }, { status: 400 });
		}
		if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) < 0)) {
			return json({ error: 'Quantity must be a valid number >= 0' }, { status: 400 });
		}
		if (unit !== undefined && (typeof unit !== 'string' || unit.trim().length === 0)) {
			return json({ error: 'Unit must be a non-empty string' }, { status: 400 });
		}
		if (status !== undefined && !['Available', 'Sold'].includes(status)) {
			return json({ error: 'Status must be Available or Sold' }, { status: 400 });
		}

		// Capture old values before update for hook comparisons
		const oldData = productDoc.data();
		const oldPrice = oldData.price;
		const oldQuantity = Number(oldData.quantity || 0);

		const updatePayload = {};
		if (name !== undefined) updatePayload.name = name;
		if (category !== undefined) updatePayload.category = category;
		if (price !== undefined) updatePayload.price = price;
		if (quantity !== undefined) updatePayload.quantity = Number(quantity);
		if (unit !== undefined) updatePayload.unit = unit;
		if (harvestDate !== undefined) updatePayload.harvestDate = harvestDate;
		if (description !== undefined) updatePayload.description = description;
		if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;
		if (farmLocation !== undefined) updatePayload.farmLocation = farmLocation;
		if (status !== undefined) updatePayload.status = status;

		await docRef.update(updatePayload);
		const updatedDoc = await docRef.get();

		// --- Hook: Record price history if price changed ---
		if (price !== undefined && price !== oldPrice) {
			adminDb.collection('priceHistory').add({
				productId: params.id,
				price: price,
				updatedAt: new Date().toISOString()
			}).catch(err => console.error('Error recording price history:', err));
		}

		// --- Hook: Notify availability subscribers if quantity 0 → >0 ---
		const newQuantity = updatePayload.quantity !== undefined ? updatePayload.quantity : oldQuantity;
		if (oldQuantity === 0 && newQuantity > 0) {
			notifyAvailabilitySubscribers(params.id, updatedDoc.data())
				.catch(err => console.error('Error notifying availability subscribers:', err));
		}

		await adminDb.collection('notifications').add({
			title: 'Product Updated',
			message: `Product "${updatedDoc.data().name}" has been updated.`,
			read: false,
			type: 'marketplace',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ id: updatedDoc.id, ...updatedDoc.data() });
	} catch (error) {
		console.error('Error updating product listing:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/**
 * Notify all buyers subscribed to a product's availability, then clean up subscriptions.
 */
async function notifyAvailabilitySubscribers(productId, productData) {
	const subsSnapshot = await adminDb.collection('availabilitySubscriptions')
		.where('productId', '==', productId)
		.get();

	if (subsSnapshot.empty) return;

	const batch = adminDb.batch();

	for (const subDoc of subsSnapshot.docs) {
		const sub = subDoc.data();

		// Create notification for the buyer
		const notifRef = adminDb.collection('notifications').doc();
		batch.set(notifRef, {
			userId: sub.buyerId,
			title: `${productData.name || 'Product'} is back in stock!`,
			message: `Good news! "${productData.name}" listed by ${productData.farmerName || 'a farmer'} is now available with ${productData.quantity} ${productData.unit || 'units'} in stock.`,
			read: false,
			type: 'availability',
			productId: productId,
			createdAt: new Date().toISOString()
		});

		// Delete the processed subscription
		batch.delete(subDoc.ref);
	}

	await batch.commit();
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const docRef = adminDb.collection('products').doc(params.id);
		const productDoc = await docRef.get();

		if (!productDoc.exists) {
			return json({ error: 'Product not found' }, { status: 404 });
		}

		if (productDoc.data().farmerId !== locals.user.uid) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await docRef.delete();

		await adminDb.collection('notifications').add({
			title: 'Product Deleted',
			message: `Product "${productDoc.data().name}" has been deleted.`,
			read: false,
			type: 'marketplace',
			userId: locals.user.uid,
			createdAt: new Date().toISOString()
		});

		return json({ success: true, message: 'Product listing deleted successfully' });
	} catch (error) {
		console.error('Error deleting product listing:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
