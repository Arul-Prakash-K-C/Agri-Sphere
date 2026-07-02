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
			const { zone, startDateStr, intervalDays, time, location, type, monthsLimit } = payload;
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
			if (zone.startsWith('Note:') || type === 'Note') {
				endDate = new Date(startDate);
			} else if (type === 'Fertilizer') {
				const months = Math.max(1, Number(monthsLimit || 1));
				endDate = new Date(startYear, startMonth1 - 1 + months, startDay);
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

				const rainSmart = !!data.rainSmartEnabled;
				const extensionDays = rainSmart && rained ? Math.max(1, Math.floor(rainProb / 20)) : 0;
				
				// Safely shift dates using a new Date object to handle month boundaries
				const shiftedDate = new Date(curYear, curMonth, curDay + extensionDays);
				const actualDate = shiftedDate.getDate();
				const actualMonth = shiftedDate.getMonth();
				const actualYear = shiftedDate.getFullYear();
				const isPostponed = extensionDays > 0;

				let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
				if (zone.startsWith('Note:')) {
					colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
				} else if (type === 'Fertilizer') {
					colorClass = 'bg-purple-50 text-purple-800 border-purple-100/50';
				} else if (isPostponed) {
					colorClass = 'bg-sky-50 text-sky-800 border-sky-100/50';
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
					intervalDays: interval,
					type: type || (zone.startsWith('Note:') ? 'Note' : 'Irrigation')
				};
				createdRuns.push(newRun);

				// Advance next run original date based purely on original date + interval
				current = new Date(curYear, curMonth, curDay + interval);
			}

			const allRunsWithNew = [...(data.scheduleRuns || []), ...createdRuns];
			const { updatedRuns, notificationsToCreate } = realignRuns(allRunsWithNew, data.weatherOverrides || {}, rainForecast, locals.user.uid, !!data.rainSmartEnabled);

			// Write notifications to Firestore (Disabled)
			
			// Build activity logs for the created runs
			const newActivities = createdRuns.map(origRun => {
				const run = updatedRuns.find(r => r.id === origRun.id) || origRun;
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

			return json({ success: true, runs: updatedRuns, activities: updatedActivities, upcomingRuns: updatedUpcoming });
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
			const { dateString, rainProbability, didRain, postponeDays } = payload;
			if (!dateString) {
				return json({ error: 'Date is required' }, { status: 400 });
			}
			
			const overrides = data.weatherOverrides || {};
			const prob = Number(rainProbability);
			const rained = !!didRain;
			
			overrides[dateString] = {
				rainProbability: prob,
				didRain: rained,
				postponeDays: Number(postponeDays || 0)
			};

			const allRuns = data.scheduleRuns || [];
			const { updatedRuns: runs, notificationsToCreate } = realignRuns(allRuns, overrides, {}, locals.user.uid, !!data.rainSmartEnabled);

			// Write notifications to Firestore (Disabled)

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

		if (action === 'toggle_rain_smart') {
			const { enabled } = payload;
			const rainSmartEnabled = !!enabled;

			const allRuns = data.scheduleRuns || [];
			const { updatedRuns: runs, notificationsToCreate } = realignRuns(allRuns, data.weatherOverrides || {}, {}, locals.user.uid, rainSmartEnabled);

			// Write notifications to Firestore (Disabled)

			const newActivity = {
				id: `act-smart-${Date.now()}`,
				title: `View Weather ${rainSmartEnabled ? 'Enabled' : 'Disabled'}`,
				desc: rainSmartEnabled ? 'Weather probabilities and overlays visible on calendar' : 'Weather overlays hidden from calendar',
				icon: rainSmartEnabled ? 'umbrella' : 'wb_sunny',
				colorClass: rainSmartEnabled ? 'bg-sky-50 text-sky-850' : 'bg-slate-100 text-slate-500'
			};
			const updatedActivities = [newActivity, ...(data.activities || [])].slice(0, 10);

			await docRef.update({ 
				rainSmartEnabled,
				activities: updatedActivities
			});

			return json({ 
				success: true, 
				rainSmartEnabled, 
				runs: data.scheduleRuns || [], 
				activities: updatedActivities, 
				upcomingRuns: data.upcomingRuns || [] 
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
			const { updatedRuns, notificationsToCreate } = realignRuns(runs, overrides, {}, locals.user.uid, !!data.rainSmartEnabled);

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

		if (action === 'edit_schedule') {
			const { oldSchedule, newSchedule } = payload;
			if (!oldSchedule || !newSchedule) {
				return json({ error: 'Old and new schedule details are required' }, { status: 400 });
			}
			const runs = data.scheduleRuns || [];
			
			// 1. Separate runs that DO NOT match the old schedule
			const otherRuns = runs.filter(r => {
				const rType = r.type || (r.zone?.startsWith('Note:') ? 'Note' : 'Irrigation');
				return !(r.zone === oldSchedule.zone && 
						 r.time === oldSchedule.time && 
						 Number(r.intervalDays || 1) === Number(oldSchedule.intervalDays) && 
						 rType === oldSchedule.type);
			});

			// 2. Determine start date for the new schedule
			let startDateStr = newSchedule.startDateStr || oldSchedule.startDateStr;
			if (!startDateStr) {
				const oldRuns = runs.filter(r => {
					const rType = r.type || (r.zone?.startsWith('Note:') ? 'Note' : 'Irrigation');
					return r.zone === oldSchedule.zone && 
						   r.time === oldSchedule.time && 
						   Number(r.intervalDays || 1) === Number(oldSchedule.intervalDays) && 
						   rType === oldSchedule.type;
				});
				if (oldRuns.length > 0) {
					oldRuns.sort((a, b) => new Date(a.originalDateStr) - new Date(b.originalDateStr));
					startDateStr = oldRuns[0].originalDateStr;
				} else {
					startDateStr = new Date().toISOString().split('T')[0];
				}
			}

			// 3. Generate new runs list
			const zone = newSchedule.zone;
			const type = newSchedule.type || 'Irrigation';
			const interval = Math.max(1, Number(newSchedule.intervalDays || 1));
			const time = newSchedule.time || '05:00 - 06:00';

			const [startYear, startMonth1, startDay] = startDateStr.split('-').map(Number);
			const startDate = new Date(startYear, startMonth1 - 1, startDay);

			let endDate;
			if (zone.startsWith('Note:') || type === 'Note') {
				endDate = new Date(startDate);
			} else if (type === 'Fertilizer') {
				const months = Math.max(1, Number(newSchedule.monthsLimit || 3));
				endDate = new Date(startYear, startMonth1 - 1 + months, startDay);
			} else {
				endDate = new Date(startYear + 1, startMonth1 - 1, startDay);
			}

			const createdRuns = [];
			let current = new Date(startDate);
			const pad = (n) => String(n).padStart(2, '0');

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
					rainProb = 0;
				}

				const rainSmart = !!data.rainSmartEnabled;
				const extensionDays = rainSmart && rained ? Math.max(1, Math.floor(rainProb / 20)) : 0;
				
				const shiftedDate = new Date(curYear, curMonth, curDay + extensionDays);
				const actualDate = shiftedDate.getDate();
				const actualMonth = shiftedDate.getMonth();
				const actualYear = shiftedDate.getFullYear();
				const isPostponed = extensionDays > 0;

				let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
				if (zone.startsWith('Note:') || type === 'Note') {
					colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
				} else if (type === 'Fertilizer') {
					colorClass = 'bg-purple-50 text-purple-800 border-purple-100/50';
				} else if (isPostponed) {
					colorClass = 'bg-sky-50 text-sky-800 border-sky-100/50';
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
					time: time,
					rainProbability: rainProb,
					didRain: rained,
					extensionDays,
					colorClass,
					intervalDays: interval,
					type: type
				};
				createdRuns.push(newRun);

				// Advance next run original date based purely on original date + interval
				current = new Date(curYear, curMonth, curDay + interval);
			}

			const allRunsWithNew = [...otherRuns, ...createdRuns];
			const { updatedRuns, notificationsToCreate } = realignRuns(allRunsWithNew, data.weatherOverrides || {}, {}, locals.user.uid, !!data.rainSmartEnabled);

			// Write notifications to Firestore (Disabled)

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

		if (action === 'delete_schedule') {
			const { zone, time, intervalDays, type } = payload;
			let runs = data.scheduleRuns || [];
			
			runs = runs.filter(r => {
				const rType = r.type || (r.zone?.startsWith('Note:') ? 'Note' : 'Irrigation');
				return !(r.zone === zone && r.time === time && Number(r.intervalDays || 1) === Number(intervalDays) && rType === type);
			});

			const overrides = data.weatherOverrides || {};
			const { updatedRuns, notificationsToCreate } = realignRuns(runs, overrides, {}, locals.user.uid, !!data.rainSmartEnabled);

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

function getLocalDate(run) {
	if (run.originalDateStr) {
		const [y, m, d] = run.originalDateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	}
	return new Date(run.originalYear, run.originalMonth, run.originalDate);
}

function realignRuns(runs, weatherOverrides, rainForecast, userId, rainSmartEnabled = false) {
	const zones = [...new Set(runs.map(r => r.zone))];
	const updatedRuns = [];
	const notificationsToCreate = [];

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const overrides = weatherOverrides || {};
	const sortedEvents = Object.keys(overrides)
		.map(dateStr => ({ dateStr, ...overrides[dateStr] }))
		.filter(ev => ev && ev.didRain)
		.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

	for (const zone of zones) {
		const zoneRuns = runs.filter(r => r.zone === zone);
		
		// Sort chronologically by original date
		zoneRuns.sort((a, b) => {
			const ad = getLocalDate(a);
			const bd = getLocalDate(b);
			return ad - bd;
		});

		// Initialize currentDateObj and other properties for all runs
		for (const run of zoneRuns) {
			const dateString = run.originalDateStr;
			const [origYear, origMonth, origDay] = dateString.split('-').map(Number);
			const origDateObj = new Date(origYear, origMonth - 1, origDay);
			
			const isPastRun = origDateObj < today;
			run.isPastRun = isPastRun;
			run.originalDateObj = origDateObj;

			if (isPastRun) {
				if (run.year !== undefined && run.month !== undefined && run.date !== undefined && run.year !== null && run.month !== null && run.date !== null) {
					run.currentDateObj = new Date(run.year, run.month, run.date);
				} else {
					run.currentDateObj = new Date(origYear, origMonth - 1, origDay);
				}
				run.rained = run.didRain || false;
				run.rainProb = run.rainProbability || 0;
				run.directShift = run.extensionDays || 0;
				run.postponedFromDateStr = run.postponedFromDateStr || null;
			} else {
				run.currentDateObj = new Date(origYear, origMonth - 1, origDay);
				run.rained = false;
				run.rainProb = 0;
				run.directShift = 0;
				run.postponedFromDateStr = null;
			}
		}

		// Apply rain events chronologically
		for (const event of sortedEvents) {
			const [ey, em, ed] = event.dateStr.split('-').map(Number);
			const eventDate = new Date(ey, em - 1, ed);
			
			// Only apply rain events that are today or in the future
			if (eventDate < today) continue;
			
			const postpone = event.postponeDays || Math.max(1, Math.floor((event.rainProbability || 0) / 20));
			
			// Find the first future run scheduled on or after eventDate
			let firstFutureRunIndex = -1;
			for (let i = 0; i < zoneRuns.length; i++) {
				const r = zoneRuns[i];
				if (!r.isPastRun && r.currentDateObj >= eventDate) {
					firstFutureRunIndex = i;
					break;
				}
			}
			
			if (firstFutureRunIndex !== -1) {
				const targetRun = zoneRuns[firstFutureRunIndex];
				
				// Set postponedFromDateStr if not already set (record the date it was scheduled on BEFORE this postponement)
				if (!targetRun.postponedFromDateStr) {
					const pad2 = (n) => String(n).padStart(2, '0');
					targetRun.postponedFromDateStr = `${targetRun.currentDateObj.getFullYear()}-${pad2(targetRun.currentDateObj.getMonth() + 1)}-${pad2(targetRun.currentDateObj.getDate())}`;
				}
				
				targetRun.directShift += postpone;
				targetRun.rained = true;
				targetRun.rainProb = Math.max(targetRun.rainProb, event.rainProbability || 0);
				targetRun.currentDateObj.setDate(targetRun.currentDateObj.getDate() + postpone);
				
				// Realign subsequent runs to preserve crop interval
				for (let j = firstFutureRunIndex + 1; j < zoneRuns.length; j++) {
					const currRun = zoneRuns[j];
					if (currRun.isPastRun) continue;
					
					const prevRun = zoneRuns[j - 1];
					const interval = Math.max(1, Number(currRun.intervalDays || 1));
					const minDateObj = new Date(prevRun.currentDateObj.getFullYear(), prevRun.currentDateObj.getMonth(), prevRun.currentDateObj.getDate() + interval);
					
					if (currRun.currentDateObj < minDateObj) {
						currRun.currentDateObj = minDateObj;
					}
				}
			}
		}

		// Update rain probability for remaining non-postponed days using forecast/overrides
		for (const run of zoneRuns) {
			if (run.isPastRun) continue;
			
			const pad2 = (n) => String(n).padStart(2, '0');
			const actualDateStr = `${run.currentDateObj.getFullYear()}-${pad2(run.currentDateObj.getMonth() + 1)}-${pad2(run.currentDateObj.getDate())}`;
			
			if (overrides[actualDateStr]) {
				run.rainProb = Math.max(run.rainProb, overrides[actualDateStr].rainProbability || 0);
			} else if (rainForecast && rainForecast[actualDateStr] !== undefined) {
				run.rainProb = Math.max(run.rainProb, rainForecast[actualDateStr]);
			} else {
				// Fallback to original day's forecast if no specific forecast for the shifted day
				const origDateStr = run.originalDateStr;
				if (overrides[origDateStr]) {
					run.rainProb = Math.max(run.rainProb, overrides[origDateStr].rainProbability || 0);
				} else if (rainForecast && rainForecast[origDateStr] !== undefined) {
					run.rainProb = Math.max(run.rainProb, rainForecast[origDateStr]);
				} else {
					run.rainProb = Math.max(run.rainProb, run.rainProbability || 0);
				}
			}
		}

		// Map back to output runs format
		for (let i = 0; i < zoneRuns.length; i++) {
			const run = zoneRuns[i];
			const actualDate = run.currentDateObj.getDate();
			const actualMonth = run.currentDateObj.getMonth();
			const actualYear = run.currentDateObj.getFullYear();
			const finalExtensionDays = run.directShift;
			const isPostponed = finalExtensionDays > 0;

			let colorClass = 'bg-emerald-50 text-dark-green border-emerald-100/50';
			if (zone.startsWith('Note:')) {
				colorClass = 'bg-amber-50 text-amber-800 border-amber-100/50';
			} else if (run.type === 'Fertilizer') {
				colorClass = 'bg-purple-50 text-purple-800 border-purple-100/50';
			} else if (isPostponed) {
				colorClass = 'bg-sky-50 text-sky-800 border-sky-100/50';
			}

			const wasPostponedBefore = run.extensionDays > 0;
			
			// Schedule database notification
			if (!run.isPastRun && isPostponed && (!wasPostponedBefore || run.extensionDays !== finalExtensionDays) && !zone.startsWith('Note:')) {
				const pad2 = (n) => String(n).padStart(2, '0');
				const nextWaterDateStr = `${actualYear}-${pad2(actualMonth + 1)}-${pad2(actualDate)}`;
				notificationsToCreate.push({
					title: 'Watering Postponed (Rain-Smart)',
					message: `${zone} watering (originally scheduled for ${run.originalDateStr}) has been postponed by ${finalExtensionDays} day(s) due to ${run.rainProb}% rain chance. Rescheduled to ${nextWaterDateStr}.`,
					read: false,
					type: 'irrigation',
					userId,
					createdAt: new Date().toISOString()
				});
			}

			zoneRuns[i] = {
				id: run.id,
				zone: run.zone,
				originalDateStr: run.originalDateStr,
				originalDate: run.originalDate,
				originalMonth: run.originalMonth,
				originalYear: run.originalYear,
				intervalDays: run.intervalDays,
				time: run.time,
				type: run.type,
				date: actualDate,
				month: actualMonth,
				year: actualYear,
				rainProbability: run.rainProb,
				didRain: run.rained,
				extensionDays: finalExtensionDays,
				postponedFromDateStr: run.postponedFromDateStr,
				colorClass
			};
		}
		
		updatedRuns.push(...zoneRuns);
	}

	return { updatedRuns, notificationsToCreate };
}
