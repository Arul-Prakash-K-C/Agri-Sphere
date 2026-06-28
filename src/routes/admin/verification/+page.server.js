/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	try {
		const res = await fetch('/api/dashboard');
		if (res.ok) {
			const data = await res.json();
			return {
				users: data.users || []
			};
		}
	} catch (err) {
		console.error('Error fetching admin verification data:', err);
	}
	return {
		users: []
	};
}
