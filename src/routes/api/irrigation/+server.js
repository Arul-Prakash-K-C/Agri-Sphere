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
			// Seed irrigation configuration as clean empty slate
			const seedData = {
				scheduleRuns: [],
				upcomingRuns: [],
				activities: [],
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

		const data = docSnap.data();
		// Clean up any legacy dummy/seeded data if present (so existing users get reset automatically)
		const hasDummies = (data.scheduleRuns || []).some(r => r.id === '1' || r.id === '2' || r.id === '3') ||
		                   (data.upcomingRuns || []).some(r => r.id === 'u1' || r.id === 'u2' || r.id === 'u3') ||
		                   (data.activities || []).some(r => r.id === 'a1' || r.id === 'a2' || r.id === 'a3');
		
		if (hasDummies) {
			const cleanedData = {
				...data,
				scheduleRuns: (data.scheduleRuns || []).filter(r => r.id !== '1' && r.id !== '2' && r.id !== '3'),
				upcomingRuns: (data.upcomingRuns || []).filter(r => r.id !== 'u1' && r.id !== 'u2' && r.id !== 'u3'),
				activities: (data.activities || []).filter(r => r.id !== 'a1' && r.id !== 'a2' && r.id !== 'a3')
			};
			await docRef.set(cleanedData);
			return json(cleanedData);
		}

		return json(data);
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
			const { zone, startDateStr, endDateStr, intervalDays, time, location } = payload;
			if (!zone || typeof zone !== 'string') {
				return json({ error: 'Zone/Crop is required' }, { status: 400 });
			}
			if (!startDateStr || !endDateStr) {
				return json({ error: 'Start and End dates are required' }, { status: 400 });
			}
			const interval = Math.max(1, Number(intervalDays || 1));

			const [startYear, startMonth1, startDay] = startDateStr.split('-').map(Number);
			const [endYear, endMonth1, endDay] = endDateStr.split('-').map(Number);

			const startDate = new Date(startYear, startMonth1 - 1, startDay);
			const endDate = new Date(endYear, endMonth1 - 1, endDay);

			if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
				return json({ error: 'Invalid start or end date' }, { status: 400 });
			}

			let lat = 38.2975; // Default Napa Valley
			let lon = -122.2869;
			const address = location || locals.profile?.address;

			const coordRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
			const match = address ? address.trim().match(coordRegex) : null;

			if (match) {
				lat = parseFloat(match[1]);
				lon = parseFloat(match[2]);
			} else if (address && address.trim().length > 0) {
				try {
					const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`);
					if (geoRes.ok) {
						const geoData = await geoRes.json();
						if (geoData.results && geoData.results[0]) {
							lat = geoData.results[0].latitude;
							lon = geoData.results[0].longitude;
						}
					}
				} catch (e) {
					console.error('Server geocoding error:', e);
				}
			}

			let rainForecast = {};
			try {
				const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max&timezone=auto&forecast_days=16`);
				if (weatherRes.ok) {
					const weatherData = await weatherRes.json();
					if (weatherData.daily && weatherData.daily.time) {
						const times = weatherData.daily.time;
						const probs = weatherData.daily.precipitation_probability_max;
						times.forEach((tStr, idx) => {
							rainForecast[tStr] = probs[idx] || 0;
						});
					}
				}
			} catch (e) {
				console.error('Server weather fetch error:', e);
			}

			const createdRuns = [];
			const pad = (n) => String(n).padStart(2, '0');

			let current = new Date(startDate);
			while (current <= endDate) {
				const curYear = current.getFullYear();
				const curMonth = current.getMonth();
				const curDay = current.getDate();
				const dateString = `${curYear}-${pad(curMonth + 1)}-${pad(curDay)}`;
				
				const overrides = data.weatherOverrides || {};
				let rainProb = 0;
				let rained = false;

				if (overrides[dateString]) {
					rainProb = overrides[dateString].rainProbability;
					rained = overrides[dateString].didRain;
				} else {
					rainProb = rainForecast[dateString] !== undefined ? rainForecast[dateString] : 0;
				}

				const extensionDays = rained ? Math.max(1, Math.floor(rainProb / 20)) : Math.floor(rainProb / 20);
				
				// Safely shift dates using a new Date object to handle month boundaries
				const shiftedDate = new Date(curYear, curMonth, curDay + extensionDays);
				const actualDate = shiftedDate.getDate();
				const actualMonth = shiftedDate.getMonth();
				const actualYear = shiftedDate.getFullYear();
				const isPostponed = extensionDays > 0;

				let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
				if (zone.startsWith('Note:')) {
					colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
				} else if (isPostponed) {
					colorClass = 'bg-sky-50 text-sky-855 border-sky-100/50';
				}

				const runId = `${Date.now()}-${curDay}-${Math.random().toString(36).substring(2, 6)}`;
				const newRun = {
					id: runId,
					originalDateStr: dateString,
					originalDate: curDay,
					originalMonth: curMonth,
					originalYear: curYear,
					date: actualDate,
					month: actualMonth,
					year: actualYear,
					zone,
					time: time || '05:00 - 06:00',
					rainProbability: rainProb,
					didRain: rained,
					extensionDays,
					colorClass
				};
				createdRuns.push(newRun);

				current.setDate(current.getDate() + interval);
			}

			const updatedRuns = [...(data.scheduleRuns || []), ...createdRuns];
			
			// Build activity logs for the created runs
			const newActivities = createdRuns.map(run => {
				const isNote = run.zone.startsWith('Note:');
				const displayTitle = isNote ? 'Note Created' : `${run.zone} Scheduled`;
				const displayDesc = isNote 
					? run.zone.substring(5).trim() 
					: `${run.time}${run.extensionDays > 0 ? ` • Shifted +${run.extensionDays}d (Rain: ${run.rainProbability}%)` : ''}`;
				return {
					id: `act-${run.id}`,
					title: displayTitle,
					desc: displayDesc,
					icon: isNote ? 'description' : 'calendar_today',
					colorClass: isNote ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-dark-green'
				};
			});
			const updatedActivities = [...newActivities, ...(data.activities || [])].slice(0, 10);

			// Derive upcoming runs dynamically (runs today or in the future)
			const today = new Date();
			const curDate = today.getDate();
			const curMonth = today.getMonth();
			const curYear = today.getFullYear();

			const updatedUpcoming = updatedRuns
				.filter(run => {
					if (run.zone.startsWith('Note:')) return false; // Only schedule runs
					if (run.year > curYear) return true;
					if (run.year === curYear && run.month > curMonth) return true;
					if (run.year === curYear && run.month === curMonth && run.date >= curDate) return true;
					return false;
				})
				.map(run => ({
					id: `up-${run.id}`,
					day: run.date,
					month: run.month,
					year: run.year,
					zone: run.zone,
					details: run.time
				}))
				.sort((a, b) => {
					const dateA = new Date(a.year ?? curYear, a.month ?? curMonth, a.day);
					const dateB = new Date(b.year ?? curYear, b.month ?? curMonth, b.day);
					return dateA - dateB;
				})
				.slice(0, 5);

			await docRef.update({ 
				scheduleRuns: updatedRuns,
				activities: updatedActivities,
				upcomingRuns: updatedUpcoming
			});

			return json({ success: true, runs: createdRuns, activities: updatedActivities, upcomingRuns: updatedUpcoming });
		}

		if (action === 'update_valves') {
			const { valves } = payload;
			if (!valves || typeof valves !== 'object') {
				return json({ error: 'Valves configuration object is required' }, { status: 400 });
			}
			
			// Detect changes to log activities
			const prevValves = data.valves || {};
			const newActivities = [];
			
			if (valves.zone1 !== undefined && valves.zone1 !== prevValves.zone1) {
				newActivities.push({
					id: `act-valve1-${Date.now()}`,
					title: `Zone 1: North Orchard ${valves.zone1 ? 'Started' : 'Stopped'}`,
					desc: `Manual Override • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
					icon: valves.zone1 ? 'play_arrow' : 'stop',
					colorClass: valves.zone1 ? 'bg-sky-50 text-sky-850' : 'bg-slate-100 text-slate-500'
				});
			}
			if (valves.zone2 !== undefined && valves.zone2 !== prevValves.zone2) {
				newActivities.push({
					id: `act-valve2-${Date.now()}`,
					title: `Zone 2: Berries ${valves.zone2 ? 'Started' : 'Stopped'}`,
					desc: `Manual Override • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
					icon: valves.zone2 ? 'play_arrow' : 'stop',
					colorClass: valves.zone2 ? 'bg-sky-50 text-sky-850' : 'bg-slate-100 text-slate-500'
				});
			}
			if (valves.zone3 !== undefined && valves.zone3 !== prevValves.zone3) {
				newActivities.push({
					id: `act-valve3-${Date.now()}`,
					title: `Zone 3: Greenhouses ${valves.zone3 ? 'Started' : 'Stopped'}`,
					desc: `Manual Override • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
					icon: valves.zone3 ? 'play_arrow' : 'stop',
					colorClass: valves.zone3 ? 'bg-sky-50 text-sky-850' : 'bg-slate-100 text-slate-500'
				});
			}
			
			const updatedActivities = [...newActivities, ...(data.activities || [])].slice(0, 10);
			await docRef.update({ valves, activities: updatedActivities });
			return json({ success: true, valves, activities: updatedActivities });
		}
		if (action === 'override_weather') {
			const { dateString, rainProbability, didRain } = payload;
			if (!dateString) {
				return json({ error: 'Date is required' }, { status: 400 });
			}
			
			const overrides = data.weatherOverrides || {};
			const prob = Number(rainProbability);
			const rained = !!didRain;
			
			overrides[dateString] = {
				rainProbability: prob,
				didRain: rained
			};

			const dateParts = dateString.split('-');
			const targetYear = Number(dateParts[0]);
			const targetMonth = Number(dateParts[1]) - 1; // 0-indexed
			const targetDay = Number(dateParts[2]);

			let runs = data.scheduleRuns || [];
			runs = runs.map(run => {
				const isMatch = run.originalDateStr 
					? run.originalDateStr === dateString
					: (run.originalDate === targetDay && (run.originalMonth !== undefined ? run.originalMonth === targetMonth : run.month === targetMonth) && (run.originalYear !== undefined ? run.originalYear === targetYear : run.year === targetYear));

				if (isMatch) {
					const extensionDays = rained ? Math.max(1, Math.floor(prob / 20)) : Math.floor(prob / 20);
					
					let origYear = run.originalYear !== undefined ? run.originalYear : run.year;
					let origMonth = run.originalMonth !== undefined ? run.originalMonth : run.month;
					let origDay = run.originalDate;
					
					if (run.originalDateStr) {
						const [y, m, d] = run.originalDateStr.split('-').map(Number);
						origYear = y;
						origMonth = m - 1;
						origDay = d;
					}

					const actualDateObj = new Date(origYear, origMonth, origDay + extensionDays);
					const actualYear = actualDateObj.getFullYear();
					const actualMonth = actualDateObj.getMonth();
					const actualDay = actualDateObj.getDate();

					const isPostponed = extensionDays > 0;
					let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
					if (run.zone.startsWith('Note:')) {
						colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
					} else if (isPostponed) {
						colorClass = 'bg-sky-50 text-sky-855 border-sky-100/50';
					}

					return {
						...run,
						date: actualDay,
						month: actualMonth,
						year: actualYear,
						rainProbability: prob,
						didRain: rained,
						extensionDays,
						colorClass
					};
				}
				return run;
			});

			const newActivity = {
				id: `act-override-${Date.now()}`,
				title: `Weather Override`,
				desc: `${dateString}: Set to ${prob}% Rain • ${rained ? 'Rained' : 'Did not rain'}`,
				icon: 'wb_sunny',
				colorClass: 'bg-amber-50 text-amber-600'
			};
			const updatedActivities = [newActivity, ...(data.activities || [])].slice(0, 10);

			const today = new Date();
			const curDate = today.getDate();
			const curMonth = today.getMonth();
			const curYear = today.getFullYear();
			
			const updatedUpcoming = runs
				.filter(run => {
					if (run.zone.startsWith('Note:')) return false;
					if (run.year > curYear) return true;
					if (run.year === curYear && run.month > curMonth) return true;
					if (run.year === curYear && run.month === curMonth && run.date >= curDate) return true;
					return false;
				})
				.map(run => ({
					id: `up-${run.id}`,
					day: run.date,
					month: run.month,
					year: run.year,
					zone: run.zone,
					details: run.time
				}))
				.sort((a, b) => {
					const dateA = new Date(a.year ?? curYear, a.month ?? curMonth, a.day);
					const dateB = new Date(b.year ?? curYear, b.month ?? curMonth, b.day);
					return dateA - dateB;
				})
				.slice(0, 5);

			await docRef.update({ 
				weatherOverrides: overrides,
				scheduleRuns: runs,
				activities: updatedActivities,
				upcomingRuns: updatedUpcoming
			});

			return json({ 
				success: true, 
				weatherOverrides: overrides, 
				runs, 
				activities: updatedActivities, 
				upcomingRuns: updatedUpcoming 
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error updating irrigation configuration:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
