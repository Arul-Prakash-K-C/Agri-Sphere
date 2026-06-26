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
		const docRef = adminDb.collection('irrigation').doc(locals.user.uid);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			const now = new Date();
			const currentM = now.getMonth();
			const currentY = now.getFullYear();
			// Seed irrigation configuration if empty
			const seedData = {
				scheduleRuns: [
					{ id: '1', date: 3, month: currentM, year: currentY, zone: 'Zone 1: North Orchard', time: '05:00 - 06:30', colorClass: 'bg-emerald-50 text-dark-green border-emerald-100/50' },
					{ id: '2', date: 7, month: currentM, year: currentY, zone: 'Zone 4: Vineyard', time: '04:30 - 05:30', colorClass: 'bg-emerald-50 text-dark-green border-emerald-100/50' },
					{ id: '3', date: 7, month: currentM, year: currentY, zone: 'Fertigation Alpha', time: '06:00 - 07:00', colorClass: 'bg-amber-50 text-amber-800 border-amber-100/50' }
				],
				upcomingRuns: [
					{ id: 'u1', day: 14, zone: 'Zone 2: Berries', details: 'Starts in 4 hours • 45m' },
					{ id: 'u2', day: 15, zone: 'Zone 3: Greenhouses', details: 'Tomorrow • 1h 20m' },
					{ id: 'u3', day: 16, zone: 'General Maintenance', details: 'Wednesday • 2h' }
				],
				activities: [
					{ id: 'a1', title: 'Zone 1 Completed', desc: 'Today, 06:30 AM • 92 gal used', icon: 'check', colorClass: 'bg-emerald-50 text-dark-green' },
					{ id: 'a2', title: 'Sensor Calibrated', desc: 'Yesterday, 11:45 PM • Zone 4', icon: 'warning', colorClass: 'bg-amber-50 text-amber-600' },
					{ id: 'a3', title: 'Schedule Updated', desc: 'Oct 12, 02:15 PM • By Admin', icon: 'edit', colorClass: 'bg-slate-100 text-slate-500' }
				],
				valves: {
					zone1: false,
					zone2: false,
					zone3: false
				},
				farmerId: locals.user.uid
			};
			await docRef.set(seedData);
			return json(seedData);
		}

		return json(docSnap.data());
	} catch (error) {
		console.error('Error fetching irrigation configuration:', error);
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
		const { action, payload } = body;

		const docRef = adminDb.collection('irrigation').doc(locals.user.uid);
		const docSnap = await docRef.get();

		if (!docSnap.exists) {
			return json({ error: 'Irrigation configuration not initialized' }, { status: 404 });
		}

		const data = docSnap.data();

		if (action === 'add_run') {
			const { zone, date, time, month, year } = payload;
			if (!zone || typeof zone !== 'string') {
				return json({ error: 'Zone is required' }, { status: 400 });
			}
			if (date === undefined || isNaN(Number(date))) {
				return json({ error: 'Date must be a number' }, { status: 400 });
			}

			const colorClass = (zone.includes('Fertigation') || zone.startsWith('Note:'))
				? 'bg-amber-50 text-amber-800 border-amber-100/50'
				: 'bg-emerald-50 text-dark-green border-emerald-100/50';

			const now = new Date();
			const newRun = {
				id: String(Date.now()),
				date: Number(date),
				month: month !== undefined ? Number(month) : now.getMonth(),
				year: year !== undefined ? Number(year) : now.getFullYear(),
				zone,
				time: time || '05:00 - 06:00',
				colorClass
			};

			const updatedRuns = [...(data.scheduleRuns || []), newRun];
			await docRef.update({ scheduleRuns: updatedRuns });
			return json({ success: true, run: newRun });
		}

		if (action === 'update_valves') {
			const { valves } = payload;
			if (!valves || typeof valves !== 'object') {
				return json({ error: 'Valves configuration object is required' }, { status: 400 });
			}
			await docRef.update({ valves });
			return json({ success: true, valves });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error updating irrigation configuration:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
