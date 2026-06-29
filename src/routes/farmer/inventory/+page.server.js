/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [invRes, cropsRes, harvestsRes] = await Promise.all([
			fetch('/api/inventory'),
			fetch('/api/crops'),
			fetch('/api/harvests')
		]);

		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };
		const crops = cropsRes.ok ? await cropsRes.json() : [];
		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];

		return {
			inventory: invData.inventory || [],
			storages: invData.storages || [],
			crops,
			harvests
		};
	} catch (err) {
		console.error('Error in inventory page server loader:', err);
	}
	return {
		inventory: [],
		storages: [],
		crops: [],
		harvests: []
	};
}
