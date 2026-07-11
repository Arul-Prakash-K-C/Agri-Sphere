import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, locals }) {
	if (!locals.user || !locals.profile || locals.profile.role !== 'farmer') {
		// Redirect non-farmers
		if (locals.profile?.role === 'admin') {
			throw redirect(303, '/admin/dashboard');
		} else if (locals.profile?.role === 'customer') {
			throw redirect(303, '/customer/dashboard');
		} else {
			throw redirect(303, '/login');
		}
	}

	try {
		const res = await fetch('/api/todo');
		if (res.ok) {
			const todos = await res.json();
			return { todos };
		}
	} catch (err) {
		console.error('Error fetching todos:', err);
	}
	
	return { todos: [] };
}
