/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [harvestsRes, cropsRes, storagesRes] = await Promise.all([
			fetch('/api/harvests'),
			fetch('/api/crops'),
			fetch('/api/storages')
		]);

		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];
		const crops = cropsRes.ok ? await cropsRes.json() : [];
		const storages = storagesRes.ok ? await storagesRes.json() : [];

		return { harvests, crops, storages };
	} catch (err) {
		console.error('Error in harvests page server loader:', err);
	}
	return { harvests: [], crops: [], storages: [] };
}
