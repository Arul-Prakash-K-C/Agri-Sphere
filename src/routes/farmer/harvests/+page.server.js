/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [harvestsRes, cropsRes] = await Promise.all([
			fetch('/api/harvests'),
			fetch('/api/crops')
		]);

		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];
		const crops = cropsRes.ok ? await cropsRes.json() : [];

		return { harvests, crops };
	} catch (err) {
		console.error('Error in harvests page server loader:', err);
	}
	return { harvests: [], crops: [] };
}
