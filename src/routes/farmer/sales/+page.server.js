/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [salesRes, invRes] = await Promise.all([
			fetch('/api/sales'),
			fetch('/api/inventory')
		]);

		const sales = salesRes.ok ? await salesRes.json() : [];
		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };

		return {
			sales,
			inventory: invData.inventory || []
		};
	} catch (err) {
		console.error('Error loading sales page:', err);
		return { sales: [], inventory: [] };
	}
}
