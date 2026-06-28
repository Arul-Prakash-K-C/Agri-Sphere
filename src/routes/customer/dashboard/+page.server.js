/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [dashRes, settingsRes] = await Promise.all([
			fetch('/api/dashboard'),
			fetch('/api/customer/settings')
		]);

		const dashData = dashRes.ok ? await dashRes.json() : { produce: [], orders: [] };
		const settingsData = settingsRes.ok ? await settingsRes.json() : { wishlist: [], favoriteFarmers: [] };

		return {
			produce: dashData.produce || [],
			orders: dashData.orders || [],
			settings: settingsData
		};
	} catch (err) {
		console.error('Error fetching customer dashboard load data:', err);
	}
	return {
		produce: [],
		orders: [],
		settings: { wishlist: [], favoriteFarmers: [] }
	};
}
