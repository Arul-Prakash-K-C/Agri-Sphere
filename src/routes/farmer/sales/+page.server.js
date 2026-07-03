/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [salesRes, invRes, harvestsRes, cropsRes] = await Promise.all([
			fetch('/api/sales'),
			fetch('/api/inventory'),
			fetch('/api/harvests'),
			fetch('/api/crops')
		]);

		const sales = salesRes.ok ? await salesRes.json() : [];
		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };
		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];
		const crops = cropsRes.ok ? await cropsRes.json() : [];

		return {
			sales,
			inventory: invData.inventory || [],
			harvests,
			crops
		};
	} catch (err) {
		console.error('Error loading sales page:', err);
		return { sales: [], inventory: [], harvests: [], crops: [] };
	}
}
