import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('todos')
			.where('farmerId', '==', locals.user.uid)
			.get();
		
		const todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		
		return json(todos);
	} catch (error) {
		console.error('Error fetching todos:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { title, description, priority, dueDate } = body;

		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const newTodo = {
			farmerId: locals.user.uid,
			title: title.trim(),
			description: description ? description.trim() : '',
			priority: priority || 'Medium',
			dueDate: dueDate || null,
			completed: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('todos').add(newTodo);

		return json({ id: docRef.id, ...newTodo }, { status: 201 });
	} catch (error) {
		console.error('Error creating todo:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
