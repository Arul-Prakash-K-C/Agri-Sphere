import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const uid = locals.activeFarmerId;

	try {
		// Calculate crop acreage total
		const cropsSnapshot = await adminDb.collection('crops')
			.where('farmerId', '==', uid)
			.get();
		
		const totalAcres = cropsSnapshot.docs.reduce((sum, doc) => sum + Number(doc.data().acres || 0), 0);

		// Calculate total expenses
		const expensesSnapshot = await adminDb.collection('expenses')
			.where('farmerId', '==', uid)
			.get();

		const totalExpenses = expensesSnapshot.docs.reduce((sum, doc) => sum + Number(doc.data().amount || 0), 0);

		// Calculate total stock items
		const inventorySnapshot = await adminDb.collection('inventory')
			.where('farmerId', '==', uid)
			.get();

		const totalInventoryItems = inventorySnapshot.docs.length;

		return json({
			totalAcres,
			totalExpenses,
			totalInventoryItems,
			efficiencyScore: 84.5
		});
	} catch (error) {
		console.error('Error fetching analytics:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
