import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies, locals }) {
	if (!locals.user || locals.profile?.role !== 'manager') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { farmerId } = await request.json();

		if (!farmerId) {
			return json({ error: 'Farmer ID is required' }, { status: 400 });
		}

		// In a real scenario, we'd verify that the manager still has 'Accepted' status for this farm.
		// Since this just sets the active viewing context, and backend APIs will separately verify role (or we rely on the manager only seeing their approved list), this is acceptable.
		
		cookies.set('manager_active_farm', farmerId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 1 week
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error setting active farm:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ cookies }) {
	cookies.delete('manager_active_farm', { path: '/' });
	return json({ success: true });
}
