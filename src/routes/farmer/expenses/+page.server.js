/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [expensesRes, invRes] = await Promise.all([
			fetch('/api/expenses'),
			fetch('/api/inventory')
		]);

		const expenses = expensesRes.ok ? await expensesRes.json() : [];
		const invData = invRes.ok ? await invRes.json() : { inventory: [], storages: [] };

		return {
			expenses,
			inventory: invData.inventory || [],
			storages: invData.storages || []
		};
	} catch (err) {
		console.error('Error in expenses page server loader:', err);
	}
	return { expenses: [], storages: [], inventory: [] };
}
