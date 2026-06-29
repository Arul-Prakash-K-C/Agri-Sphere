/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [salesRes, invRes, harvestsRes] = await Promise.all([
			fetch('/api/sales'),
			fetch('/api/inventory'),
			fetch('/api/harvests')
		]);

		const sales = salesRes.ok ? await salesRes.json() : [];
		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };
		const harvests = harvestsRes.ok ? await harvestsRes.json() : [];

		return {
			sales,
			inventory: invData.inventory || [],
			harvests
		};
	} catch (err) {
		console.error('Error loading sales page:', err);
		return { sales: [], inventory: [], harvests: [] };
	}
}
