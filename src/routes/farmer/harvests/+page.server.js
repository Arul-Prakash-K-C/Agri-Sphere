/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [harvestsRes, cropsRes, invRes] = await Promise.all([
			fetch('/api/harvests'),
			fetch('/api/crops'),
			fetch('/api/inventory')
		]);

		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];
		const crops = cropsRes.ok ? await cropsRes.json() : [];
		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };

		return {
			harvests,
			crops,
			inventory: invData.inventory || [],
			storages: invData.storages || []
		};
	} catch (err) {
		console.error('Error in harvests page server loader:', err);
	}
	return { harvests: [], crops: [], storages: [], inventory: [] };
}
