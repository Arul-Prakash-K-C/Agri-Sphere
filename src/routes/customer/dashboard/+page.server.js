/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const [dashRes, settingsRes, subsRes] = await Promise.all([
			fetch('/api/dashboard'),
			fetch('/api/customer/settings'),
			fetch('/api/availability-subscriptions')
		]);

		const dashData = dashRes.ok ? await dashRes.json() : { produce: [], orders: [] };
		const settingsData = settingsRes.ok ? await settingsRes.json() : { wishlist: [], favoriteFarmers: [] };
		const subsData = subsRes.ok ? await subsRes.json() : [];

		return {
			produce: dashData.produce || [],
			orders: dashData.orders || [],
			settings: settingsData,
			subscriptions: subsData
		};
	} catch (err) {
		console.error('Error fetching customer dashboard load data:', err);
	}
	return {
		produce: [],
		orders: [],
		settings: { wishlist: [], favoriteFarmers: [] },
		subscriptions: []
	};
}
