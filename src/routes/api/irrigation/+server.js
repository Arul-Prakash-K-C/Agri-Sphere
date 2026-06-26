import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { env } from '$env/dynamic/private';

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
			const { zone, startDateStr, intervalDays, time, location } = payload;
			if (!zone || typeof zone !== 'string') {
				return json({ error: 'Zone/Crop is required' }, { status: 400 });
			}
			if (!startDateStr) {
				return json({ error: 'Start date is required' }, { status: 400 });
			}
			const interval = Math.max(1, Number(intervalDays || 1));

			const [startYear, startMonth1, startDay] = startDateStr.split('-').map(Number);
			const startDate = new Date(startYear, startMonth1 - 1, startDay);

			let endDate;
			if (zone.startsWith('Note:')) {
				endDate = new Date(startDate);
			} else {
				// Irrigation occurs throughout the year: set end date to 1 year in the future
				endDate = new Date(startYear + 1, startMonth1 - 1, startDay);
			}

			if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
				return json({ error: 'Invalid start or end date' }, { status: 400 });
			}

			let lat = 38.2975; // Default Napa Valley
			let lon = -122.2869;
			const address = location || locals.profile?.address;

			const coordRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
			const match = address ? address.trim().match(coordRegex) : null;

			const apiKey = env.VITE_OPENWEATHER_API_KEY || env.OPENWEATHER_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY : '');

			if (match) {
				lat = parseFloat(match[1]);
				lon = parseFloat(match[2]);
			} else if (address && address.trim().length > 0) {
				let geocoded = false;
				if (apiKey) {
					try {
						const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(address)}&limit=1&appid=${apiKey}`);
						if (geoRes.ok) {
							const geoData = await geoRes.json();
							if (geoData && geoData[0]) {
								lat = geoData[0].lat;
								lon = geoData[0].lon;
								geocoded = true;
							}
						}
					} catch (e) {
						console.error('Server OpenWeather geocoding error:', e);
					}
				}
				
				if (!geocoded) {
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
						console.error('Server fallback geocoding error:', e);
					}
				}
			}

			let rainForecast = {};
			if (apiKey) {
				try {
					const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`);
					if (weatherRes.ok) {
						const weatherData = await weatherRes.json();
						if (weatherData.list) {
							const maxPopsByDate = {};
							weatherData.list.forEach(item => {
								const dStr = item.dt_txt.split(' ')[0];
								const popPercent = Math.round((item.pop || 0) * 100);
								if (maxPopsByDate[dStr] === undefined || popPercent > maxPopsByDate[dStr]) {
									maxPopsByDate[dStr] = popPercent;
								}
							});
							Object.entries(maxPopsByDate).forEach(([dStr, popVal]) => {
								rainForecast[dStr] = popVal;
							});
						}
					}
				} catch (e) {
					console.error('Server OpenWeather forecast error:', e);
				}
			}

			try {
				const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max&timezone=auto&forecast_days=16`);
				if (weatherRes.ok) {
					const weatherData = await weatherRes.json();
					if (weatherData.daily && weatherData.daily.time) {
						const times = weatherData.daily.time;
						const probs = weatherData.daily.precipitation_probability_max;
						times.forEach((tStr, idx) => {
							if (rainForecast[tStr] === undefined) {
								rainForecast[tStr] = probs[idx] || 0;
							}
						});
					}
				}
			} catch (e) {
				console.error('Server Open-Meteo weather fetch error:', e);
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
					colorClass,
					intervalDays: interval
				};
				createdRuns.push(newRun);

				// Advance next run original date to be after the shifted date of this run plus interval
				current = new Date(actualYear, actualMonth, actualDate + interval);
			}

			const allRunsWithNew = [...(data.scheduleRuns || []), ...createdRuns];
			const { updatedRuns, notificationsToCreate } = realignRuns(allRunsWithNew, data.weatherOverrides || {}, rainForecast, locals.user.uid);

			// Write notifications to Firestore
			if (notificationsToCreate.length > 0) {
				const batch = adminDb.batch();
				for (const notif of notificationsToCreate) {
					const notifRef = adminDb.collection('notifications').doc();
					batch.set(notifRef, notif);
				}
				await batch.commit();
			}
			
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

			const allRuns = data.scheduleRuns || [];
			const { updatedRuns: runs, notificationsToCreate } = realignRuns(allRuns, overrides, {}, locals.user.uid);

			// Write notifications to Firestore
			if (notificationsToCreate.length > 0) {
				const batch = adminDb.batch();
				for (const notif of notificationsToCreate) {
					const notifRef = adminDb.collection('notifications').doc();
					batch.set(notifRef, notif);
				}
				await batch.commit();
			}

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

		if (action === 'delete_run') {
			const { runId } = payload;
			if (!runId) {
				return json({ error: 'Run ID is required' }, { status: 400 });
			}

			const runs = (data.scheduleRuns || []).filter(r => r.id !== runId);
			const overrides = data.weatherOverrides || {};

			// Realign runs after deletion
			const { updatedRuns, notificationsToCreate } = realignRuns(runs, overrides, {}, locals.user.uid);

			const today = new Date();
			const curDate = today.getDate();
			const curMonth = today.getMonth();
			const curYear = today.getFullYear();

			const updatedUpcoming = updatedRuns
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
				scheduleRuns: updatedRuns,
				upcomingRuns: updatedUpcoming
			});

			return json({ success: true, runs: updatedRuns, upcomingRuns: updatedUpcoming });
		}

		if (action === 'clear_all') {
			await docRef.update({
				scheduleRuns: [],
				upcomingRuns: [],
				activities: [],
				weatherOverrides: {}
			});
			return json({ success: true, runs: [], upcomingRuns: [], activities: [] });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Error updating irrigation configuration:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

function realignRuns(runs, weatherOverrides, rainForecast, userId) {
	const zones = [...new Set(runs.map(r => r.zone))];
	const updatedRuns = [];
	const notificationsToCreate = [];

	for (const zone of zones) {
		const zoneRuns = runs.filter(r => r.zone === zone);
		
		// Sort chronologically by original date
		zoneRuns.sort((a, b) => {
			const ad = a.originalDateStr ? new Date(a.originalDateStr) : new Date(a.originalYear, a.originalMonth, a.originalDate);
			const bd = b.originalDateStr ? new Date(b.originalDateStr) : new Date(b.originalYear, b.originalMonth, b.originalDate);
			return ad - bd;
		});

		let prevActualDateObj = null;

		for (let i = 0; i < zoneRuns.length; i++) {
			const run = zoneRuns[i];
			const dateString = run.originalDateStr;
			const [origYear, origMonth, origDay] = dateString.split('-').map(Number);
			
			const overrides = weatherOverrides || {};
			let rainProb = 0;
			let rained = false;

			if (overrides[dateString]) {
				rainProb = overrides[dateString].rainProbability;
				rained = overrides[dateString].didRain;
			} else if (rainForecast && rainForecast[dateString] !== undefined) {
				rainProb = rainForecast[dateString];
			} else {
				rainProb = run.rainProbability || 0;
				rained = run.didRain || false;
			}

			const weatherShift = rained ? Math.max(1, Math.floor(rainProb / 20)) : Math.floor(rainProb / 20);
			
			// Standard shifted date based purely on weather of this day
			let actualShifted = new Date(origYear, origMonth - 1, origDay + weatherShift);

			// If there is a previous run, ensure interval is respected (skip interval - 1 days)
			if (prevActualDateObj) {
				const interval = Math.max(1, Number(run.intervalDays || 1));
				const minDateObj = new Date(prevActualDateObj.getFullYear(), prevActualDateObj.getMonth(), prevActualDateObj.getDate() + interval);
				if (actualShifted < minDateObj) {
					actualShifted = minDateObj;
				}
			}

			// Calculate final shifted extension days from the original scheduled date
			const origDateObj = new Date(origYear, origMonth - 1, origDay);
			const diffTime = actualShifted.getTime() - origDateObj.getTime();
			const finalExtensionDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

			const actualDate = actualShifted.getDate();
			const actualMonth = actualShifted.getMonth();
			const actualYear = actualShifted.getFullYear();
			const isPostponed = finalExtensionDays > 0;

			let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
			if (zone.startsWith('Note:')) {
				colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
			} else if (isPostponed) {
				colorClass = 'bg-sky-50 text-sky-855 border-sky-100/50';
			}

			const wasPostponedBefore = run.extensionDays > 0;
			
			// If a new postponement occurs or has been extended, schedule a database notification
			if (isPostponed && (!wasPostponedBefore || run.extensionDays !== finalExtensionDays) && !zone.startsWith('Note:')) {
				const pad2 = (n) => String(n).padStart(2, '0');
				const nextWaterDateStr = `${actualYear}-${pad2(actualMonth + 1)}-${pad2(actualDate)}`;
				notificationsToCreate.push({
					title: 'Watering Postponed (Rain-Smart)',
					message: `${zone} watering (originally scheduled for ${dateString}) has been postponed by ${finalExtensionDays} day(s) due to ${rainProb}% rain chance. Rescheduled to ${nextWaterDateStr}.`,
					read: false,
					type: 'irrigation',
					userId,
					createdAt: new Date().toISOString()
				});
			}

			zoneRuns[i] = {
				...run,
				date: actualDate,
				month: actualMonth,
				year: actualYear,
				rainProbability: rainProb,
				didRain: rained,
				extensionDays: finalExtensionDays,
				colorClass
			};

			prevActualDateObj = actualShifted;
		}
		updatedRuns.push(...zoneRuns);
	}

	return { updatedRuns, notificationsToCreate };
}
