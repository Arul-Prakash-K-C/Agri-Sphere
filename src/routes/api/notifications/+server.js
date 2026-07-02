import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	// Notifications disabled. Return empty list with zero Firestore reads.
	return json([]);
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH() {
	// Notifications disabled. Do nothing.
	return json({ success: true });
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE() {
	// Notifications disabled. Do nothing.
	return json({ success: true });
}
