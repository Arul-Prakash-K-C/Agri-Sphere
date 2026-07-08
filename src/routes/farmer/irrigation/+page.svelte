<script>
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { preferences } from '$lib/preferences.svelte.js';

	let { data } = $props();

	let scheduleRuns = $state([]);
	let upcomingRuns = $state([]);
	let activities = $state([]);
	let weatherOverrides = $state({});
	let rainSmartEnabled = $state(false);

	// Sync data on page load or update
	$effect(() => {
		scheduleRuns = data.scheduleRuns || [];
		upcomingRuns = data.upcomingRuns || [];
		activities = data.activities || [];
		weatherOverrides = data.weatherOverrides || {};
		rainSmartEnabled = data.rainSmartEnabled || false;
	});

	async function handleToggleRainSmart() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'toggle_rain_smart',
					payload: { enabled: rainSmartEnabled }
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to toggle Rain-Smart mode');
			}

			const result = await res.json();
			rainSmartEnabled = result.rainSmartEnabled;
			scheduleRuns = result.runs || [];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;
		} catch (err) {
			error = err.message;
			rainSmartEnabled = !rainSmartEnabled;
		} finally {
			loading = false;
		}
	}

	let showAddModal = $state(false);

	// Calendar Navigation
	const today = new Date();
	const todayDate = today.getDate();
	const todayMonth = today.getMonth();
	const todayYear = today.getFullYear();

	let currentYear = $state(todayYear);
	let currentMonth = $state(todayMonth);

	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	function prevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear -= 1;
		} else {
			currentMonth -= 1;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear += 1;
		} else {
			currentMonth += 1;
		}
	}

	let firstDayIndex = $derived(new Date(currentYear, currentMonth, 1).getDay());
	let totalDaysInMonth = $derived(new Date(currentYear, currentMonth + 1, 0).getDate());
	let remainingCells = $derived((7 - ((firstDayIndex + totalDaysInMonth) % 7)) % 7);

	// Form values for new run or note
	let scheduledType = $state('Irrigation'); // 'Irrigation' | 'Fertilizer' | 'Note'
	let filterType = $state('All'); // 'All' | 'Irrigation' | 'Fertilizer' | 'Note'
	let customNoteText = $state('');
	let newZone = $state('Dragon Fruit');
	let newStartDateStr = $state('');
	let newEndDateStr = $state('');
	let newIntervalDays = $state(1);
	let clickedDay = $state(1);
	let newTime = $state('05:00 - 06:00');
	let fertilizerMonths = $state(3);

	// Editing states
	let editModalActive = $state(false);
	let manageModalActive = $state(false);
	let editingSchedule = $state(null);
	let editZone = $state('');
	let editTime = $state('');
	let editIntervalDays = $state(1);
	let editType = $state('Irrigation');
	let editStartDateStr = $state('');

	const pad = (n) => String(n).padStart(2, '0');

	// Responsive and interactive calendar states
	let selectedDateKey = $state(`${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`);
	let calendarViewMode = $state('month'); // 'month' | 'agenda'
	let showDayDetailsModal = $state(false);

	// Derived: schedules on the currently selected day
	let selectedDayRuns = $derived.by(() => {
		const [y, m, d] = selectedDateKey.split('-').map(Number);
		return scheduleRuns.filter(r => 
			((r.date === d && 
			  Number(r.month ?? 9) === (m - 1) && 
			  Number(r.year ?? 2023) === y) ||
			 (r.postponedFromDateStr === selectedDateKey)) &&
			(filterType === 'All' || 
			 (filterType === 'Irrigation' && (r.type === 'Irrigation' || !r.type)) || 
			 (filterType === 'Fertilizer' && r.type === 'Fertilizer') || 
			 (filterType === 'Note' && (r.type === 'Note' || r.zone?.startsWith('Note:'))))
		);
	});

	// Derived: 7 days of the week containing selectedDateKey
	let agendaWeekDays = $derived.by(() => {
		const [y, m, d] = selectedDateKey.split('-').map(Number);
		const selDate = new Date(y, m - 1, d);
		const dayOfWeek = selDate.getDay(); // 0 (Sun) to 6 (Sat)
		
		const week = [];
		for (let i = 0; i < 7; i++) {
			const tempDate = new Date(y, m - 1, d - dayOfWeek + i);
			const formattedKey = `${tempDate.getFullYear()}-${pad(tempDate.getMonth() + 1)}-${pad(tempDate.getDate())}`;
			week.push({
				dateNumber: tempDate.getDate(),
				month: tempDate.getMonth(),
				year: tempDate.getFullYear(),
				dateKey: formattedKey
			});
		}
		return week;
	});

	let firstDayIndexMonday = $derived((new Date(currentYear, currentMonth, 1).getDay() + 6) % 7);
	let prevMonthDays = $derived.by(() => {
		const prevMonthDate = new Date(currentYear, currentMonth, 0);
		const prevLast = prevMonthDate.getDate();
		const prevMonthNum = prevMonthDate.getMonth();
		const prevYearNum = prevMonthDate.getFullYear();
		const days = [];
		for (let i = firstDayIndexMonday - 1; i >= 0; i--) {
			const dNum = prevLast - i;
			days.push({
				dateNumber: dNum,
				month: prevMonthNum,
				year: prevYearNum,
				dateKey: `${prevYearNum}-${pad(prevMonthNum + 1)}-${pad(dNum)}`
			});
		}
		return days;
	});
	let nextMonthDays = $derived.by(() => {
		const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
		const nextMonthNum = nextMonthDate.getMonth();
		const nextYearNum = nextMonthDate.getFullYear();
		const totalCells = totalDaysInMonth + firstDayIndexMonday;
		const nextCount = (7 - (totalCells % 7)) % 7;
		const days = [];
		for (let i = 1; i <= nextCount; i++) {
			days.push({
				dateNumber: i,
				month: nextMonthNum,
				year: nextYearNum,
				dateKey: `${nextYearNum}-${pad(nextMonthNum + 1)}-${pad(i)}`
			});
		}
		return days;
	});

	let weatherLocation = $state('Napa Valley');
	let weatherTempToday = $state(82);
	let weatherPrecipitationToday = $state(0);
	let dailyPrecipitation = $state({});

	let locationSearchInput = $state('');
	let activeWeatherAddress = $state('');
	let detectingLocation = $state(false);

	let overrideRainProbability = $state(0);
	let overrideDidRain = $state(false);
	let overridePostponeDays = $state(1);
	let modalActiveTab = $state('event'); // 'event' | 'weather'
	let weatherLoading = $state(false);

	// Sync weather location search input and active address on load or update
	$effect(() => {
		const initialLoc = data.location || data.profile?.address || 'Napa Valley';
		locationSearchInput = initialLoc;
		activeWeatherAddress = initialLoc;
	});

	let activeRainToday = $derived(
		weatherOverrides[`${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`] 
			? weatherOverrides[`${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`].rainProbability 
			: weatherPrecipitationToday
	);

	let avgRainNext2Weeks = $derived.by(() => {
		const today = new Date();
		let sum = 0;
		let count = 0;
		const pad = (n) => String(n).padStart(2, '0');
		for (let i = 0; i < 14; i++) {
			const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
			const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
			if (dailyPrecipitation[dateStr] !== undefined) {
				sum += dailyPrecipitation[dateStr];
				count++;
			}
		}
		return count > 0 ? Math.round(sum / count) : 0;
	});

	async function updateLocationWeather(address) {
		if (!address || address.trim().length === 0) return;
		weatherLoading = true;

		// Persist the searched location to the database so it stays saved across logouts/closes
		try {
			await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_location',
					payload: { location: address.trim() }
				})
			});
		} catch (e) {
			console.error('Error persisting location to db:', e);
		}
		
		let lat = 38.2975;
		let lon = -122.2869;
		let resolvedLocationName = address;

		const coordRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
		const match = address.trim().match(coordRegex);

		const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

		if (match) {
			lat = parseFloat(match[1]);
			lon = parseFloat(match[2]);
			resolvedLocationName = `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
			activeWeatherAddress = address.trim();

			try {
				const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`, {
					headers: { 'User-Agent': 'Agri-Sphere-App/1.0' }
				});
				if (reverseRes.ok) {
					const reverseData = await reverseRes.json();
					if (reverseData.address) {
						const addr = reverseData.address;
						const city = addr.city || addr.town || addr.village || addr.suburb || '';
						const state = addr.state || '';
						resolvedLocationName = [city, state].filter(Boolean).join(', ') || resolvedLocationName;
					}
				}
			} catch (e) {
				console.error('Reverse geocoding error:', e);
			}
		} else {
			let geocoded = false;
			if (apiKey) {
				try {
					const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(address)}&limit=1&appid=${apiKey}`);
					if (geoRes.ok) {
						const geoData = await geoRes.json();
						if (geoData && geoData[0]) {
							const result = geoData[0];
							lat = result.lat;
							lon = result.lon;
							resolvedLocationName = [result.name, result.state, result.country].filter(Boolean).slice(0, 2).join(', ');
							activeWeatherAddress = address;
							geocoded = true;
						}
					}
				} catch (e) {
					console.error('Frontend OpenWeather geocoding error:', e);
				}
			}

			if (!geocoded) {
				try {
					const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`);
					if (geoRes.ok) {
						const geoData = await geoRes.json();
						if (geoData.results && geoData.results[0]) {
							const result = geoData.results[0];
							lat = result.latitude;
							lon = result.longitude;
							resolvedLocationName = [result.name, result.admin1, result.country].filter(Boolean).slice(0, 2).join(', ');
							activeWeatherAddress = address;
						}
					}
				} catch (e) {
					console.error('Frontend fallback geocoding error:', e);
				}
			}
		}

		// First fetch Open-Meteo to populate 16 days baseline and general current temp/precip
		try {
			const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&daily=precipitation_probability_max,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`);
			if (weatherRes.ok) {
				const weatherData = await weatherRes.json();
				if (weatherData.daily && weatherData.daily.time) {
					const times = weatherData.daily.time;
					const probs = weatherData.daily.precipitation_probability_max;
					const temps = weatherData.daily.temperature_2m_max;
					
					const newDailyPrecip = {};
					times.forEach((tStr, idx) => {
						newDailyPrecip[tStr] = probs[idx] || 0;
					});
					dailyPrecipitation = newDailyPrecip;

					if (probs && probs.length > 0) {
						weatherPrecipitationToday = probs[0] || 0;
					}
					if (weatherData.current && weatherData.current.temperature_2m !== undefined) {
						weatherTempToday = Math.round(weatherData.current.temperature_2m);
					} else if (temps && temps.length > 0) {
						weatherTempToday = Math.round(temps[0]);
					}
					weatherLocation = resolvedLocationName;
				}
			}
		} catch (e) {
			console.error('Frontend Open-Meteo weather fetch error:', e);
		}

		// Overwrite/merge with OpenWeatherMap data if API key is present
		if (apiKey) {
			try {
				const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`);
				if (weatherRes.ok) {
					const weatherData = await weatherRes.json();
					if (weatherData.list) {
						// Group 3-hourly forecast records by day to get the daily maximum precipitation probability
						const maxPopsByDate = {};
						weatherData.list.forEach(item => {
							const dStr = item.dt_txt.split(' ')[0];
							const popPercent = Math.round((item.pop || 0) * 100);
							if (maxPopsByDate[dStr] === undefined || popPercent > maxPopsByDate[dStr]) {
								maxPopsByDate[dStr] = popPercent;
							}
						});

						// Overwrite the baseline precipitation values for the matching OpenWeatherMap forecast days
						const updatedPrecip = { ...dailyPrecipitation };
						Object.entries(maxPopsByDate).forEach(([dStr, popPercent]) => {
							updatedPrecip[dStr] = popPercent;
						});
						dailyPrecipitation = updatedPrecip;

						// Update today's weather variables with OpenWeatherMap values
						const todayStr = `${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`;
						if (maxPopsByDate[todayStr] !== undefined) {
							weatherPrecipitationToday = maxPopsByDate[todayStr];
						}

						// Convert first interval's temperature from Kelvin to Fahrenheit
						if (weatherData.list[0] && weatherData.list[0].main && weatherData.list[0].main.temp !== undefined) {
							const tempKelvin = weatherData.list[0].main.temp;
							weatherTempToday = Math.round((tempKelvin - 273.15) * 1.8 + 32);
						}
					}
				}
			} catch (e) {
				console.error('Frontend OpenWeather weather fetch/parse error:', e);
			}
		}

		weatherLoading = false;

		// Save the successfully fetched location to local storage
		if (typeof localStorage !== 'undefined' && address) {
			localStorage.setItem('farmer_irrigation_location', address);
		}
	}

	function detectBrowserLocation() {
		if (!navigator.geolocation) {
			alert("Geolocation is not supported by your browser.");
			return;
		}

		detectingLocation = true;
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const lat = position.coords.latitude;
				const lon = position.coords.longitude;
				const coordStr = `${lat.toFixed(6)},${lon.toFixed(6)}`;
				
				locationSearchInput = coordStr;
				await updateLocationWeather(coordStr);
				detectingLocation = false;
			},
			(err) => {
				console.error('Geolocation error:', err);
				alert(`Failed to detect location: ${err.message}`);
				detectingLocation = false;
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	onMount(() => {
		const savedLocation = localStorage.getItem('farmer_irrigation_location');
		const defaultAddr = data.profile?.address || 'Napa Valley';
		const addressToUse = savedLocation || defaultAddr;
		updateLocationWeather(addressToUse);
	});

	let loading = $state(false);
	let error = $state('');

	function openAddModalForDate(day) {
		clickedDay = day;
		const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
		newStartDateStr = dateStr;
		newEndDateStr = dateStr;
		newIntervalDays = 1;
		scheduledType = 'Irrigation';
		customNoteText = '';
		newZone = 'Dragon Fruit';
		newTime = '05:00 - 06:00';
		error = '';
		modalActiveTab = 'event';

		const dateKey = dateStr;
		if (weatherOverrides[dateKey]) {
			overrideRainProbability = weatherOverrides[dateKey].rainProbability;
			overrideDidRain = weatherOverrides[dateKey].didRain;
			overridePostponeDays = weatherOverrides[dateKey].postponeDays || Math.max(1, Math.floor(overrideRainProbability / 20));
		} else {
			overrideRainProbability = dailyPrecipitation[dateKey] || 0;
			overrideDidRain = false;
			overridePostponeDays = Math.max(1, Math.floor(overrideRainProbability / 20));
		}

		showAddModal = true;
	}

	function handleDayClick(day, dateKey, cellRuns) {
		selectedDateKey = dateKey;
		clickedDay = day;
		
		if (cellRuns && cellRuns.length > 0) {
			if (calendarViewMode === 'agenda') {
				// Agenda mode: just highlight, no details modal
			} else {
				showDayDetailsModal = true;
			}
		} else {
			openAddModalForDate(day);
		}
	}

	async function handleAddRun(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const displayZone = scheduledType === 'Note' ? `Note: ${customNoteText}` : newZone;
		const displayTime = scheduledType === 'Note' && !newTime ? 'All Day' : (newTime || '05:00 - 06:00');
		const clickedDateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(clickedDay)}`;

		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'add_run',
					payload: {
						zone: displayZone,
						startDateStr: clickedDateStr,
						intervalDays: Number(newIntervalDays),
						time: displayTime,
						location: activeWeatherAddress,
						type: scheduledType,
						monthsLimit: scheduledType === 'Fertilizer' ? Number(fertilizerMonths) : undefined
					}
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to add schedule item');
			}

			const result = await res.json();
			scheduleRuns = result.runs || [];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;

			// Clear form & close
			scheduledType = 'Irrigation';
			customNoteText = '';
			newZone = 'Dragon Fruit';
			newStartDateStr = '';
			newEndDateStr = '';
			newIntervalDays = 1;
			newTime = '05:00 - 06:00';
			fertilizerMonths = 3;
			showAddModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	let uniqueSchedules = $derived.by(() => {
		const map = new Map();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (const run of scheduleRuns) {
			const rType = run.type || (run.zone?.startsWith('Note:') ? 'Note' : 'Irrigation');
			const key = `${run.zone}-${run.intervalDays}-${run.time}-${rType}`;
			
			const runDate = new Date(run.year, run.month, run.date);
			
			if (!map.has(key)) {
				map.set(key, {
					zone: run.zone,
					intervalDays: run.intervalDays || 1,
					time: run.time || '05:00 - 06:00',
					type: rType,
					startDateStr: run.originalDateStr,
					nextRunDate: runDate >= today ? runDate : null,
					id: run.id
				});
			} else {
				const existing = map.get(key);
				if (new Date(run.originalDateStr) < new Date(existing.startDateStr)) {
					existing.startDateStr = run.originalDateStr;
					existing.id = run.id;
				}
				if (runDate >= today) {
					if (!existing.nextRunDate || runDate < existing.nextRunDate) {
						existing.nextRunDate = runDate;
					}
				}
			}
		}
		
		const list = Array.from(map.values());
		for (const item of list) {
			if (item.nextRunDate) {
				item.nextRunStr = item.nextRunDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			} else {
				item.nextRunStr = 'None';
			}
			if (item.startDateStr) {
				const [y, m, d] = item.startDateStr.split('-').map(Number);
				item.startDateFormatted = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			} else {
				item.startDateFormatted = '—';
			}
		}
		return list;
	});

	let computedUpcomingRuns = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Filter runs that occur today or in the future
		const futureRuns = scheduleRuns.filter(run => {
			const runDate = new Date(run.year, run.month, run.date);
			return runDate >= today;
		});

		// Sort by nearest date first
		futureRuns.sort((a, b) => {
			const dateA = new Date(a.year, a.month, a.date);
			const dateB = new Date(b.year, b.month, b.date);
			return dateA - dateB;
		});

		// Get the next 5 runs
		return futureRuns.slice(0, 5).map(run => {
			const runDate = new Date(run.year, run.month, run.date);
			const diffTime = runDate.getTime() - today.getTime();
			const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			
			const rType = run.type || (run.zone?.startsWith('Note:') ? 'Note' : 'Irrigation');
			
			return {
				id: run.id,
				zone: run.zone,
				type: rType,
				dateStr: runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
				daysRemaining,
				time: run.time || '05:00 - 06:00',
				isToday: daysRemaining === 0
			};
		});
	});

	function openEditModal(schedule) {
		editingSchedule = schedule;
		editZone = schedule.zone;
		editTime = schedule.time;
		editIntervalDays = schedule.intervalDays;
		editType = schedule.type;
		editStartDateStr = schedule.startDateStr || '';
		error = '';
		editModalActive = true;
	}

	async function handleEditSchedule(event) {
		event.preventDefault();
		if (!editingSchedule) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'edit_schedule',
					payload: {
						oldSchedule: {
							zone: editingSchedule.zone,
							time: editingSchedule.time,
							intervalDays: editingSchedule.intervalDays,
							type: editingSchedule.type,
							startDateStr: editingSchedule.startDateStr
						},
						newSchedule: {
							zone: editZone,
							time: editTime,
							intervalDays: Number(editIntervalDays),
							type: editType,
							startDateStr: editStartDateStr
						}
					}
				})
			});
			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to edit schedule');
			}
			const result = await res.json();
			scheduleRuns = result.runs || [];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;
			editModalActive = false;
			editingSchedule = null;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteSchedule(schedule) {
		if (!confirm('Are you sure you want to delete this entire schedule series?')) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_schedule',
					payload: {
						zone: schedule.zone,
						time: schedule.time,
						intervalDays: schedule.intervalDays,
						type: schedule.type
					}
				})
			});
			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to delete schedule series');
			}
			const result = await res.json();
			scheduleRuns = result.runs || [];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleSaveWeatherOverride(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(clickedDay)}`;

		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'override_weather',
					payload: {
						dateString: dateKey,
						rainProbability: Number(overrideRainProbability),
						didRain: overrideDidRain,
						postponeDays: overrideDidRain ? Number(overridePostponeDays) : 0
					}
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to save weather override');
			}

			const result = await res.json();
			weatherOverrides = result.weatherOverrides || {};
			scheduleRuns = result.runs || [];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;

			showAddModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function deleteRun(runId) {
		if (!confirm('Are you sure you want to delete this scheduled item?')) return;
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_run',
					payload: { runId }
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to delete schedule item');
			}

			const result = await res.json();
			scheduleRuns = result.runs || [];
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function clearAll() {
		if (!confirm('Are you sure you want to clear ALL scheduled irrigation events, notes, and weather adjustments? This cannot be undone.')) return;
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'clear_all'
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to clear all items');
			}

			const result = await res.json();
			scheduleRuns = result.runs || [];
			upcomingRuns = result.upcomingRuns || [];
			activities = result.activities || [];
			weatherOverrides = {};
			manageModalActive = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function getCropEmoji(zoneName) {
		const name = (zoneName || '').toLowerCase();
		
		// Fruits
		if (
			name.includes('dragon') || name.includes('pitaya') || name.includes('pitahaya') ||
			name.includes('berry') || name.includes('strawberry') || name.includes('blueberry') || name.includes('raspberry') ||
			name.includes('grape') || name.includes('vineyard') || name.includes('wine') ||
			name.includes('apple') || name.includes('pear') || name.includes('peach') || name.includes('orchard') ||
			name.includes('orange') || name.includes('lemon') || name.includes('citrus') ||
			name.includes('fruit') || name.includes('mango') || name.includes('banana') || name.includes('melon') || name.includes('watermelon')
		) {
			return '🍎';
		}

		// Vegies / Vegetables
		if (
			name.includes('tomato') || name.includes('cucumber') || name.includes('squash') || name.includes('zucchini') ||
			name.includes('lettuce') || name.includes('spinach') || name.includes('cabbage') || name.includes('greens') || name.includes('salad') ||
			name.includes('potato') || name.includes('tuber') || name.includes('yam') ||
			name.includes('carrot') || name.includes('radish') ||
			name.includes('chili') || name.includes('pepper') ||
			name.includes('vegie') || name.includes('vegetable') || name.includes('onion') || name.includes('garlic') || name.includes('broccoli')
		) {
			return '🥕';
		}

		// Crops / Grains
		if (
			name.includes('wheat') || name.includes('rice') || name.includes('grain') || name.includes('paddy') ||
			name.includes('corn') || name.includes('maize') || name.includes('crop') || name.includes('field') ||
			name.includes('barley') || name.includes('oat') || name.includes('rye')
		) {
			return '🌾';
		}

		return '🌱'; // Default fallback
	}

	function getCropColorClasses(zoneName) {
		const emoji = getCropEmoji(zoneName);
		if (emoji === '🍎') {
			return 'bg-red-50 text-red-950 border-red-100';
		}
		if (emoji === '🥕') {
			return 'bg-orange-50 text-orange-950 border-orange-100';
		}
		if (emoji === '🌾') {
			return 'bg-amber-50/70 text-amber-950 border-amber-100';
		}
		return 'bg-emerald-50 text-emerald-950 border-emerald-100';
	}

	// Interactive calendar hover highlights
	let hoveredCell = $state(null);
</script>

<svelte:head>
	<title>Irrigation Control - Agri-Sphere</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header & Actions -->
	<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">💧</span> Irrigation Control
			</h1>
			<p class="text-sm text-slate-500 mt-1">Monitor and schedule water distribution zones.</p>
		</div>
		<div class="flex flex-wrap items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0 font-semibold text-slate-700 font-bold">
			<!-- Location Monitor & View Weather Widget -->
			<div class="flex items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-1.5 pl-3 pr-3.5 shadow-sm hover:shadow-md transition-shadow duration-300">
				<!-- Monitor Location Input -->
				<div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 w-[220px] focus-within:border-primary-green focus-within:bg-white transition-all">
					<span class="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
					<input 
						type="text" 
						placeholder="Search location..." 
						bind:value={locationSearchInput}
						onkeydown={(e) => e.key === 'Enter' && updateLocationWeather(locationSearchInput)}
						class="w-full bg-transparent text-[11px] font-semibold text-slate-700 placeholder-slate-400 border-none outline-none focus:outline-none focus:ring-0 p-0"
					/>
					<button 
						onclick={() => updateLocationWeather(locationSearchInput)}
						class="px-2 py-0.5 bg-primary-green text-white text-[9px] font-bold rounded-md hover:bg-dark-green transition-all cursor-pointer shrink-0 shadow-xs"
					>
						GO
					</button>
					<button 
						type="button"
						onclick={detectBrowserLocation}
						disabled={detectingLocation}
						class="text-slate-400 hover:text-primary-green transition-all cursor-pointer shrink-0 flex items-center"
						title="Auto-detect current location"
					>
						{#if detectingLocation}
							<span class="material-symbols-outlined text-[13px] animate-spin">sync</span>
						{:else}
							<span class="material-symbols-outlined text-[13px]">my_location</span>
						{/if}
					</button>
				</div>

				<!-- Divider -->
				<div class="h-6 w-px bg-slate-200 hidden sm:block"></div>

				<!-- View Weather Toggle -->
				<div class="flex items-center gap-1">
					<button 
						type="button"
						onclick={() => { rainSmartEnabled = !rainSmartEnabled; handleToggleRainSmart(); }}
						class="flex items-center justify-center p-0.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
						title="Toggle Weather ({rainSmartEnabled ? 'On' : 'Off'})"
					>
						<span class="material-symbols-outlined text-[16px] {rainSmartEnabled ? 'text-blue-500 font-bold' : 'text-slate-400'}">umbrella</span>
					</button>
					<div class="text-left leading-none hidden sm:block mr-1">
						<span class="block text-[9px] font-black text-slate-800">View Weather</span>
						<span class="text-[8px] text-slate-400 font-semibold">{rainSmartEnabled ? 'On' : 'Off'}</span>
					</div>
					<label class="relative inline-flex items-center cursor-pointer select-none">
						<input type="checkbox" bind:checked={rainSmartEnabled} onchange={handleToggleRainSmart} class="sr-only peer" />
						<div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
					</label>
				</div>
			</div>

			<button 
				onclick={() => manageModalActive = true}
				class="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-[11px] px-4 py-2.5 rounded-full flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shadow-xs"
				title="Manage active repeating schedules"
			>
				<span class="material-symbols-outlined text-[16px] text-primary-green">settings_suggest</span>
				<span>Manage Schedules</span>
			</button>

			<button 
				onclick={() => openAddModalForDate(1)}
				class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-[11px] px-4 py-2.5 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
			>
				<span class="material-symbols-outlined text-[16px]">calendar_today</span>
				<span>Add Schedules</span>
			</button>
		</div>
	</div>

	<!-- Ad	<!-- Add Run / Note Modal -->
	<Modal 
		bind:show={showAddModal} 
		size="md" 
		title={modalActiveTab === 'weather' ? `Adjust Weather (${monthNames[currentMonth].substring(0, 3)} ${clickedDay})` : (scheduledType === 'Note' ? `Add Note for ${monthNames[currentMonth].substring(0, 3)} ${clickedDay}` : `Schedule ${scheduledType} (starts ${monthNames[currentMonth].substring(0, 3)} ${clickedDay})`)}
		onSubmit={modalActiveTab === 'event' ? handleAddRun : handleSaveWeatherOverride}
	>
		<!-- Modal Tabs -->
		<div class="flex gap-4 border-b border-slate-100 pb-2.5 text-[10px] font-bold uppercase tracking-wider mb-4">
			<button 
				type="button"
				onclick={() => modalActiveTab = 'event'}
				class={['pb-1 transition-all border-b-2 cursor-pointer', 
					modalActiveTab === 'event' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
			>
				Schedule Event / Note
			</button>
			<button 
				type="button"
				onclick={() => modalActiveTab = 'weather'}
				class={['pb-1 transition-all border-b-2 cursor-pointer', 
					modalActiveTab === 'weather' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
			>
				Adjust Weather
			</button>
		</div>

		{#if modalActiveTab === 'event'}
			<div class="space-y-4 text-xs font-semibold text-slate-700">
				<!-- Event Type Toggle -->
				<div class="space-y-1">
					<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Event Type</span>
					<div class="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
						<button 
							type="button" 
							onclick={() => { scheduledType = 'Irrigation'; newTime = '05:00 - 06:00'; }} 
							class={['py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer', scheduledType === 'Irrigation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
						>
							Irrigation
						</button>
						<button 
							type="button" 
							onclick={() => { scheduledType = 'Fertilizer'; newTime = '05:00 - 06:00'; }} 
							class={['py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer', scheduledType === 'Fertilizer' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
						>
							Fertilizer
						</button>
						<button 
							type="button" 
							onclick={() => { scheduledType = 'Note'; newTime = ''; }} 
							class={['py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer', scheduledType === 'Note' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
						>
							Custom Note
						</button>
					</div>
				</div>
				
				<!-- Location indicator -->
				<div class="rounded-xl bg-slate-50 border border-slate-200/50 p-2.5 flex items-center justify-between text-[10px] text-slate-500">
					<span class="font-bold flex items-center gap-1">
						<span class="material-symbols-outlined text-primary-green text-[14px]">location_on</span>
						Scheduling Location:
					</span>
					<span class="font-black text-slate-800 text-right truncate max-w-[200px]" title={weatherLocation}>{weatherLocation}</span>
				</div>

				{#if scheduledType !== 'Note'}
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{scheduledType} Crop / Zone Name</span>
						<input type="text" bind:value={newZone} required placeholder="e.g. Dragon Fruit, North Orchard" class="input-field w-full text-xs" />
					</label>
				{:else}
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Note Description</span>
						<textarea bind:value={customNoteText} required placeholder="e.g. Clean zone sprinkler heads, record soil moisture, inspect pipeline..." class="input-field w-full text-xs" rows="2"></textarea>
					</label>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Interval (Days)</span>
						<input type="number" min="1" bind:value={newIntervalDays} required={scheduledType !== 'Note'} disabled={scheduledType === 'Note'} placeholder="e.g. 1 (every day)" class="input-field w-full text-xs" />
					</label>
					{#if scheduledType === 'Fertilizer'}
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Range (Months)</span>
							<input type="number" min="1" max="12" bind:value={fertilizerMonths} required placeholder="e.g. 3" class="input-field w-full text-xs" />
						</label>
					{:else}
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Time Block</span>
							<input type="text" bind:value={newTime} required={scheduledType !== 'Note'} placeholder={scheduledType === 'Note' ? "e.g. All Day (optional)" : "e.g. 05:00 - 06:00"} class="input-field w-full text-xs" />
						</label>
					{/if}
				</div>

				{#if error}
					<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
						⚠️ {error}
					</div>
				{/if}
			</div>
		{:else}
			<!-- Weather Override Form -->
			<div class="space-y-4 text-xs font-semibold text-slate-700">
				<div class="rounded-xl bg-slate-50 border border-slate-200/50 p-3 flex flex-col gap-2 text-slate-500">
					<span class="font-bold flex items-center gap-1 text-[10px] text-slate-655 font-extrabold uppercase tracking-wider">
						<span class="material-symbols-outlined text-amber-500 text-[14px]">wb_sunny</span>
						Manual Weather Controls
					</span>
					<p class="text-[9px] font-normal leading-normal">
						Adjust this specific date's weather properties if the live forecast is incorrect. Existing scheduled irrigation runs on this day will automatically recalculate and adjust.
					</p>
				</div>

				<div class="space-y-1">
					<span class="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Precipitation Probability ({overrideRainProbability}%)</span>
					<div class="flex items-center gap-4">
						<input 
							type="range" 
							min="0" 
							max="100" 
							step="1" 
							bind:value={overrideRainProbability}
							class="flex-1 accent-primary-green h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
						/>
						<input 
							type="number" 
							min="0" 
							max="100" 
							step="1" 
							bind:value={overrideRainProbability} 
							class="w-14 text-center bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs text-slate-700" 
						/>
					</div>
				</div>

				<!-- Did it Rain Toggle -->
				<div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
					<div>
						<span class="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Did it Rain?</span>
						<span class="block text-[9px] font-normal text-slate-400 font-medium">Specify if rain actually occurred on this day</span>
					</div>
					<label class="relative inline-flex items-center cursor-pointer select-none">
						<input type="checkbox" bind:checked={overrideDidRain} class="sr-only peer" />
						<div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-green"></div>
					</label>
				</div>

				{#if overrideDidRain}
					<div class="space-y-1">
						<span class="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Days to Postpone</span>
						<input 
							type="number" 
							min="1" 
							max="30" 
							bind:value={overridePostponeDays} 
							class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:border-primary-green" 
						/>
					</div>
				{/if}

				{#if error}
					<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
						⚠️ {error}
					</div>
				{/if}
			</div>
		{/if}

		{#snippet footer()}
			<button 
				type="button" 
				onclick={() => showAddModal = false}
				class="btn-secondary flex-1 py-3 text-xs cursor-pointer"
			>
				Cancel
			</button>
			<button 
				type="submit" 
				disabled={loading}
				class="btn-primary flex-1 py-3 text-xs cursor-pointer"
			>
				{#if modalActiveTab === 'event'}
					{loading ? 'Adding...' : 'Add Item'}
				{:else}
					{loading ? 'Saving...' : 'Save Adjustments'}
				{/if}
			</button>
		{/snippet}
	</Modal>


	<!-- Main Body Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		<!-- Left Panel: Interactive Schedule (8 cols) -->
		<div class="lg:col-span-8 space-y-6 hidden lg:block">
			<div class="glass-card rounded-2xl overflow-hidden bg-white">
				<div class="p-6 border-b border-slate-100 flex items-center justify-between">
					<div class="flex items-center gap-4">
						<h3 class="font-extrabold text-slate-800 text-base">{monthNames[currentMonth]} {currentYear}</h3>
						<select 
							bind:value={filterType}
							class="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-primary-green cursor-pointer"
						>
							<option value="All">All Activities</option>
							<option value="Irrigation">Irrigation Only</option>
							<option value="Fertilizer">Fertilizer Only</option>
							<option value="Note">Notes Only</option>
						</select>
					</div>
					<div class="flex items-center gap-2">
						<!-- Toggle view mode on mobile -->
						<button 
							type="button"
							onclick={() => calendarViewMode = calendarViewMode === 'month' ? 'agenda' : 'month'}
							class="md:hidden flex items-center justify-center p-1.5 border border-slate-200 rounded-xl text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
							title={calendarViewMode === 'month' ? 'Switch to Agenda Strip' : 'Switch to Month Grid'}
						>
							<span class="material-symbols-outlined text-base">
								{calendarViewMode === 'month' ? 'splitscreen' : 'calendar_view_month'}
							</span>
						</button>
						<button onclick={prevMonth} class="size-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 transition-colors cursor-pointer" title="Previous Month">
							<span class="material-symbols-outlined text-base">chevron_left</span>
						</button>
						<button onclick={nextMonth} class="size-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 transition-colors cursor-pointer" title="Next Month">
							<span class="material-symbols-outlined text-base">chevron_right</span>
						</button>
					</div>
				</div>
				
				<!-- Calendar Grid -->
					<div class="grid grid-cols-7 bg-slate-50/50">
						<!-- Day Headers -->
						{#each ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as day}
							<div class="p-1.5 md:p-3 text-center text-[10px] font-black text-slate-400 border-r border-b border-slate-100">{day}</div>
						{/each}

						{#if calendarViewMode === 'month'}
							<!-- Empty Cells for previous month alignment -->
							{#each Array.from({ length: firstDayIndex }) as _}
								<div class="min-h-[60px] md:min-h-[110px] border-r border-b border-slate-100 bg-slate-50/10"></div>
							{/each}

							<!-- Days of current month -->
							{#each Array.from({ length: totalDaysInMonth }) as _, index}
								{@const dateNumber = index + 1}
								{@const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(dateNumber)}`}
								{@const override = weatherOverrides[dateKey]}
								{@const rainChance = override ? override.rainProbability : (dailyPrecipitation[dateKey] || 0)}
								{@const didItRain = override ? override.didRain : false}
								{@const cellRuns = scheduleRuns.filter(r => 
									((r.date === dateNumber && 
									  Number(r.month ?? 9) === currentMonth && 
									  Number(r.year ?? 2023) === currentYear) ||
									 (r.postponedFromDateStr === dateKey)) &&
									(filterType === 'All' || 
									 (filterType === 'Irrigation' && (r.type === 'Irrigation' || !r.type)) || 
									 (filterType === 'Fertilizer' && r.type === 'Fertilizer') || 
									 (filterType === 'Note' && (r.type === 'Note' || r.zone?.startsWith('Note:'))))
								)}
								
								<div 
									role="gridcell"
									tabindex="0"
									onclick={() => handleDayClick(dateNumber, dateKey, cellRuns)}
									onkeydown={(e) => e.key === 'Enter' && handleDayClick(dateNumber, dateKey, cellRuns)}
									onmouseenter={() => hoveredCell = dateNumber}
									onmouseleave={() => hoveredCell = null}
									class={['min-h-[60px] md:min-h-[110px] p-1.5 md:p-3 border-r border-b border-slate-100 flex flex-col justify-between transition-colors relative cursor-pointer group hover:bg-slate-50/50',
										selectedDateKey === dateKey ? 'bg-primary-green/10 border-primary-green/45 shadow-xs ring-1 ring-primary-green/30' : (hoveredCell === dateNumber ? 'bg-slate-50' : 'bg-white'),
										(dateNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear && selectedDateKey !== dateKey) ? 'bg-emerald-50/40 border-primary-green/30' : ''
									].filter(Boolean).join(' ')}
								>
									<div class="flex justify-between items-center w-full">
										<span class={['text-[10px] md:text-[11px] font-bold', (selectedDateKey === dateKey) ? 'text-primary-green font-black underline decoration-2 underline-offset-2' : ((dateNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear) ? 'text-primary-green font-black' : 'text-slate-400')].filter(Boolean).join(' ')}>
											{dateNumber}
										</span>
										<div class="flex items-center gap-0.5 md:gap-1">
											{#if (rainSmartEnabled && rainChance > 0) || didItRain}
												<span 
													class={['text-[8px] font-black flex items-center gap-0.5', didItRain ? 'text-sky-700 bg-sky-100/50 px-1 py-0.5 rounded-md border border-sky-200/30' : 'text-sky-600'].filter(Boolean).join(' ')} 
													title={didItRain ? 'Manual override: Rained (' + rainChance + '%)' : 'Rain probability: ' + rainChance + '%'}
												>
													<span class="material-symbols-outlined text-[9px] md:text-[10px] text-sky-500 fill-1">
														{didItRain ? 'umbrella' : 'rainy'}
													</span>
													<span class="hidden sm:inline">{didItRain ? 'Rained' : rainChance + '%'}</span>
												</span>
											{/if}
										<span class="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary-green transition-opacity hidden md:inline">add</span>
									</div>
								</div>
								<!-- Event Chips/Indicators inside cell -->
								{#if cellRuns.length > 0 || rainChance > 0 || didItRain}
									<div class="flex flex-wrap gap-1 justify-center mt-2 w-full pb-1">
										<!-- Rain Indicator (Blue line) -->
										{#if (rainSmartEnabled && rainChance > 0) || didItRain}
											<span class="h-1 rounded-full flex-grow max-w-[24px] bg-blue-500" title="Rain Forecast"></span>
										{/if}
										{#each cellRuns.slice(0, 4) as run}
											{@const isNote = run.zone?.startsWith('Note:')}
											{@const isOriginalDayPlaceholder = run.postponedFromDateStr === dateKey}
											{#if !isOriginalDayPlaceholder}
												{@const colorClass = isNote ? 'bg-slate-350' : (run.type === 'Fertilizer' ? 'bg-purple-500' : 'bg-primary-green')}
												<span class={['h-1 rounded-full flex-grow max-w-[24px]', colorClass].join(' ')} title={isNote ? run.zone.substring(5).trim() : run.zone}></span>
											{/if}
										{/each}
										{#if cellRuns.filter(r => r.postponedFromDateStr !== dateKey).length > 4}
											<span class="text-[8px] font-bold text-slate-400 pl-1 shrink-0 select-none">
												+{cellRuns.filter(r => r.postponedFromDateStr !== dateKey).length - 4}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						{/each}

						<!-- Additional empty cells to finish grid rows -->
						{#each Array.from({ length: remainingCells }) as _}
							<div class="min-h-[60px] md:min-h-[110px] border-r border-b border-slate-100 bg-slate-50/10"></div>
						{/each}
					{:else}
						<!-- Collapsed Agenda Strip View (Agenda mode on mobile) -->
						{#each agendaWeekDays as day}
							{@const dateNumber = day.dateNumber}
							{@const dateKey = day.dateKey}
							{@const override = weatherOverrides[dateKey]}
							{@const rainChance = override ? override.rainProbability : (dailyPrecipitation[dateKey] || 0)}
							{@const didItRain = override ? override.didRain : false}
							{@const cellRuns = scheduleRuns.filter(r => 
								((r.date === dateNumber && 
								  Number(r.month ?? 9) === day.month && 
								  Number(r.year ?? 2023) === day.year) ||
								 (r.postponedFromDateStr === dateKey)) &&
								(filterType === 'All' || 
								 (filterType === 'Irrigation' && (r.type === 'Irrigation' || !r.type)) || 
								 (filterType === 'Fertilizer' && r.type === 'Fertilizer') || 
								 (filterType === 'Note' && (r.type === 'Note' || r.zone?.startsWith('Note:'))))
							)}
							
							<div 
								role="gridcell"
								tabindex="0"
								onclick={() => handleDayClick(dateNumber, dateKey, cellRuns)}
								onkeydown={(e) => e.key === 'Enter' && handleDayClick(dateNumber, dateKey, cellRuns)}
								class={['min-h-[60px] md:min-h-[110px] p-1.5 md:p-3 border-r border-b border-slate-100 flex flex-col justify-between transition-colors relative cursor-pointer group hover:bg-slate-50/50',
									selectedDateKey === dateKey ? 'bg-primary-green/10 border-primary-green/45 shadow-xs ring-1 ring-primary-green/30' : (dateKey === `${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}` ? 'bg-emerald-50/40 border-primary-green/30' : 'bg-white')
								].filter(Boolean).join(' ')}
							>
								<div class="flex justify-between items-center w-full">
									<span class={['text-[10px] md:text-[11px] font-bold', (selectedDateKey === dateKey) ? 'text-primary-green font-black underline decoration-2 underline-offset-2' : 'text-slate-400'].filter(Boolean).join(' ')}>
										{dateNumber}
									</span>
									<div class="flex items-center gap-0.5 md:gap-1">
										{#if (rainSmartEnabled && rainChance > 0) || didItRain}
											<span 
												class={['text-[8px] font-black flex items-center gap-0.5', didItRain ? 'text-sky-700 bg-sky-100/50 px-1 py-0.5 rounded-md border border-sky-200/30' : 'text-sky-600'].filter(Boolean).join(' ')} 
												title={didItRain ? 'Manual override: Rained (' + rainChance + '%)' : 'Rain probability: ' + rainChance + '%'}
											>
												<span class="material-symbols-outlined text-[9px] md:text-[10px] text-sky-500 fill-1">
													{didItRain ? 'umbrella' : 'rainy'}
												</span>
											</span>
										{/if}
									</div>
								</div>
								
								{#if cellRuns.length > 0}
									<div class="flex flex-wrap gap-1 justify-center mt-1 w-full md:block md:space-y-1.5 md:mt-2">
										{#each cellRuns.slice(0, 2) as run}
											{#if run.zone.startsWith('Note:')}
												<!-- Desktop View -->
												<div class="hidden md:flex relative rounded-xl overflow-hidden text-[9px] font-extrabold border border-amber-200/50 shadow-sm leading-tight min-h-[44px] flex-col justify-between group/run text-amber-950 bg-gradient-to-br from-amber-50 to-amber-100 w-full">
													<div class="p-1.5 flex flex-col justify-between h-full min-h-[44px] pr-5">
														<div class="flex items-start gap-1">
															<span class="material-symbols-outlined text-[10px] shrink-0 mt-0.5 text-amber-600">description</span>
															<span class="font-bold line-clamp-2">{run.zone.substring(5).trim()}</span>
														</div>
														<div class="font-normal opacity-85 text-[8px] mt-1">{run.time}</div>
													</div>
												</div>
												<!-- Mobile View -->
												<div class="flex md:hidden items-center justify-center size-5 rounded-md bg-amber-100 border border-amber-200 text-amber-800 text-[10px] shadow-xs shrink-0 select-none" title={run.zone.substring(5).trim()}>
													<span>📝</span>
												</div>
											{:else}
												{@const isOriginalDayPlaceholder = run.postponedFromDateStr === dateKey}
												<!-- Desktop View -->
												<div class={['hidden md:flex relative rounded-xl overflow-hidden text-[9px] font-extrabold border shadow-sm leading-tight min-h-[44px] flex-col justify-between group/run w-full', isOriginalDayPlaceholder ? 'bg-slate-50 border-slate-200 text-slate-400 border-dashed opacity-75' : getCropColorClasses(run.zone)].filter(Boolean).join(' ')}>
													<div class="relative p-1.5 flex flex-col justify-between h-full min-h-[44px] z-10">
														<div class="flex items-center justify-between gap-1">
															<span class={['font-black truncate', isOriginalDayPlaceholder ? 'line-through' : ''].filter(Boolean).join(' ')}>
																{run.zone}
															</span>
														</div>
														<div class="font-normal opacity-75 text-[8px] mt-0.5">{run.time}</div>
													</div>
												</div>
												<!-- Mobile View -->
												<div class={['flex md:hidden items-center justify-center size-5 rounded-md border text-[10px] shadow-xs shrink-0 select-none', isOriginalDayPlaceholder ? 'bg-slate-50 border-slate-200 opacity-50 border-dashed' : getCropColorClasses(run.zone)].filter(Boolean).join(' ')} title="{run.zone} ({run.time})">
													<span>{isOriginalDayPlaceholder ? '💤' : getCropEmoji(run.zone)}</span>
												</div>
											{/if}
										{/each}
										{#if cellRuns.length > 2}
											<div class="flex md:hidden items-center justify-center text-[7.5px] font-black text-slate-455 bg-slate-100 border border-slate-200/50 rounded-md size-5 select-none shrink-0" title="{cellRuns.length - 2} more runs">
												+{cellRuns.length - 2}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Mobile Collapsed Day Agenda View -->
			{#if calendarViewMode === 'agenda'}
				<div class="md:hidden glass-card rounded-2xl p-6 bg-slate-900 border border-slate-800 text-white space-y-4">
					<div class="flex items-center justify-between border-b border-slate-800 pb-3">
						<div>
							<h4 class="text-sm font-black text-white">
								{new Date(selectedDateKey.split('-')[0], selectedDateKey.split('-')[1] - 1, selectedDateKey.split('-')[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
							</h4>
							<p class="text-[10px] font-bold text-slate-400 mt-0.5">{selectedDayRuns.length} schedule{selectedDayRuns.length === 1 ? '' : 's'}</p>
						</div>
						<button 
							onclick={() => openAddModalForDate(Number(selectedDateKey.split('-')[2]))} 
							class="flex items-center gap-1.5 px-3 py-1.5 bg-primary-green hover:bg-dark-green text-white font-extrabold text-[10px] rounded-xl transition-all cursor-pointer shadow-sm"
						>
							<span class="material-symbols-outlined text-xs">add</span>
							<span>Add</span>
						</button>
					</div>

					<div class="space-y-3 max-h-60 overflow-y-auto pr-1">
						{#if selectedDayRuns.length === 0}
							<div class="text-center py-6 text-slate-500 font-semibold text-xs flex flex-col items-center justify-center gap-2">
								<span class="material-symbols-outlined text-[32px] text-slate-700">water_drop</span>
								<span>No irrigation scheduled for this day</span>
							</div>
						{:else}
							{#each selectedDayRuns as run}
								{@const isNote = run.zone.startsWith('Note:')}
								{@const isOriginalDayPlaceholder = run.postponedFromDateStr === selectedDateKey}
								<div class={['p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-xs bg-slate-950/40', isNote ? 'border-amber-900/50 text-amber-200' : (isOriginalDayPlaceholder ? 'border-slate-800 text-slate-500' : 'border-slate-800')].filter(Boolean).join(' ')}>
									<div class="flex items-start justify-between gap-3">
										<div class="flex items-start gap-2 min-w-0">
											<span class="text-base leading-none select-none shrink-0 mt-0.5">
												{isNote ? '📝' : (isOriginalDayPlaceholder ? '💤' : getCropEmoji(run.zone))}
											</span>
											<div class="min-w-0">
												<h5 class="text-[11.5px] font-extrabold leading-snug truncate">
													{isNote ? run.zone.substring(5).trim() : run.zone}
												</h5>
												<p class="text-[9px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
													<span class="material-symbols-outlined text-[10.5px]">schedule</span>
													<span>{run.time}</span>
												</p>
											</div>
										</div>
										<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white shrink-0" style="background-color: {run.type === 'Fertilizer' ? '#8B5CF6' : (run.type === 'Note' || isNote ? '#F59E0B' : '#10B981')}">
											{run.type || 'Irrigation'}
										</span>
									</div>

									{#if run.extensionDays > 0}
										<div class="text-[8.5px] font-bold text-sky-400 pl-6">
											☔ Postponed +{run.extensionDays}d due to {run.rainProbability}% rain forecast.
										</div>
									{/if}

									{#if !isOriginalDayPlaceholder}
										<div class="flex justify-end gap-2 border-t border-slate-800/40 pt-2 mt-0.5">
											{#if !isNote}
												<button 
													onclick={(e) => { e.stopPropagation(); openEditModal(run); }} 
													class="text-[9px] font-black text-slate-350 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
												>
													Edit
												</button>
											{/if}
											<button 
												onclick={(e) => { e.stopPropagation(); deleteRun(run.id); }} 
												class="text-[9px] font-black text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-950/30 transition-colors cursor-pointer"
											>
												Delete
											</button>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Mobile Reference-style Calendar Layout (shown block lg:hidden on mobile) -->
		<div class="lg:col-span-8 space-y-6 block lg:hidden p-4 rounded-3xl font-sans relative border shadow-2xl transition-colors duration-300 {preferences.theme === 'dark' ? 'bg-black text-white border-slate-900' : 'bg-white text-slate-850 border-slate-200'}">
			
			<!-- 1. Top Mobile Header -->
			<div class="flex items-center justify-between py-2 border-b gap-4 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
				<select 
					bind:value={filterType}
					class="text-[10px] font-bold rounded-xl px-2 py-1 focus:outline-none focus:border-primary-green cursor-pointer shrink-0 max-w-[110px] {preferences.theme === 'dark' ? 'text-slate-400 bg-slate-950 border-slate-800' : 'text-slate-650 bg-slate-50 border-slate-200'}"
				>
					<option value="All">All Activities</option>
					<option value="Irrigation">Irrigation Only</option>
					<option value="Fertilizer">Fertilizer Only</option>
					<option value="Note">Notes Only</option>
				</select>
				<h2 class="text-base font-black tracking-widest uppercase text-center flex-grow select-none">
					{monthNames[currentMonth].substring(0, 3).toUpperCase()}
				</h2>
				<div class="flex items-center">
					<button 
						type="button" 
						onclick={() => {
							const todayStr = `${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`;
							currentMonth = todayMonth;
							currentYear = todayYear;
							selectedDateKey = todayStr;
							clickedDay = todayDate;
						}} 
						class="flex items-center justify-center border-2 rounded-lg size-6 text-[10px] font-black transition-colors cursor-pointer {preferences.theme === 'dark' ? 'border-white text-white hover:bg-white hover:text-black' : 'border-slate-850 text-slate-855 hover:bg-slate-850 hover:text-white'}"
						title="Go to Today"
					>
						{todayDate}
					</button>
				</div>
			</div>

			<!-- 2. Weekday row -->
			<div class="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 py-1">
				{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as day, idx}
					<span class={idx === 6 ? 'text-red-500' : ''}>{day}</span>
				{/each}
			</div>

			<!-- 3. Month Grid -->
			<div class="grid grid-cols-7 gap-y-2.5 {preferences.theme === 'dark' ? 'bg-black' : 'bg-white'}">
				<!-- Previous month overflow days -->
				{#each prevMonthDays as day}
					<div 
						role="gridcell"
						tabindex="0"
						onclick={() => { currentMonth = day.month; currentYear = day.year; selectedDateKey = day.dateKey; clickedDay = day.dateNumber; }}
						onkeydown={(e) => e.key === 'Enter' && (selectedDateKey = day.dateKey)}
						class="min-h-[50px] p-1 flex flex-col items-center justify-between text-[11px] font-bold cursor-pointer {preferences.theme === 'dark' ? 'text-slate-800 opacity-30' : 'text-slate-300 opacity-50'}"
					>
						<span>{day.dateNumber}</span>
					</div>
				{/each}

				<!-- Current month days -->
				{#each Array.from({ length: totalDaysInMonth }) as _, index}
					{@const dateNumber = index + 1}
					{@const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(dateNumber)}`}
					{@const isSelected = selectedDateKey === dateKey}
					{@const override = weatherOverrides[dateKey]}
					{@const rainChance = override ? override.rainProbability : (dailyPrecipitation[dateKey] || 0)}
					{@const didItRain = override ? override.didRain : false}
					{@const cellRuns = scheduleRuns.filter(r => 
						((r.date === dateNumber && 
						  Number(r.month ?? 9) === currentMonth && 
						  Number(r.year ?? 2023) === currentYear) ||
						 (r.postponedFromDateStr === dateKey)) &&
						(filterType === 'All' || 
						 (filterType === 'Irrigation' && (r.type === 'Irrigation' || !r.type)) || 
						 (filterType === 'Fertilizer' && r.type === 'Fertilizer') || 
						 (filterType === 'Note' && (r.type === 'Note' || r.zone?.startsWith('Note:'))))
					)}
					
					<div 
						role="gridcell"
						tabindex="0"
						onclick={() => handleDayClick(dateNumber, dateKey, cellRuns)}
						onkeydown={(e) => e.key === 'Enter' && handleDayClick(dateNumber, dateKey, cellRuns)}
						class={['min-h-[50px] p-1 flex flex-col items-center justify-between text-[11px] font-bold relative cursor-pointer rounded-lg',
							isSelected ? (preferences.theme === 'dark' ? 'border border-white shadow-xs' : 'border border-slate-800 shadow-xs') : ''
						].filter(Boolean).join(' ')}
					>
						<!-- Date number pill -->
						<span class={['size-6 flex items-center justify-center rounded-full leading-none',
							isSelected ? (preferences.theme === 'dark' ? 'bg-white text-black font-black' : 'bg-slate-800 text-white font-black') : (dateNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear ? 'text-primary-green ring-1 ring-primary-green/50' : (preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'))
						].filter(Boolean).join(' ')}>
							{dateNumber}
						</span>

						<!-- Event Chips/Indicators inside cell -->
						{#if cellRuns.length > 0 || rainChance > 0 || didItRain}
							<div class="flex gap-0.5 justify-center mt-1 w-full pb-0.5">
								<!-- Rain Indicator (Blue line) -->
								{#if (rainSmartEnabled && rainChance > 0) || didItRain}
									<span class="h-0.5 rounded-full flex-grow max-w-[8px] bg-blue-500" title="Rain Forecast"></span>
								{/if}
								{#each cellRuns.slice(0, 3) as run}
									{@const isOriginalDayPlaceholder = run.postponedFromDateStr === dateKey}
									{#if !isOriginalDayPlaceholder}
										{@const colorClass = run.zone?.startsWith('Note:') ? (preferences.theme === 'dark' ? 'bg-white' : 'bg-slate-350') : (run.type === 'Fertilizer' ? 'bg-purple-500' : 'bg-primary-green')}
										<span class={['h-0.5 rounded-full flex-grow max-w-[8px]', colorClass].join(' ')}></span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/each}
				
				<!-- Next month overflow days -->
				{#each nextMonthDays as day}
					<div 
						role="gridcell"
						tabindex="0"
						onclick={() => { currentMonth = day.month; currentYear = day.year; selectedDateKey = day.dateKey; clickedDay = day.dateNumber; }}
						onkeydown={(e) => e.key === 'Enter' && (selectedDateKey = day.dateKey)}
						class="min-h-[50px] p-1 flex flex-col items-center justify-between text-slate-800 text-[11px] font-bold opacity-30 cursor-pointer"
					>
						<span>{day.dateNumber}</span>
					</div>
				{/each}
			</div>

			<!-- Divider -->
			<div class="border-t border-slate-900/60 my-2"></div>

			<!-- 4. Bottom Selected-Day Section -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-bold {preferences.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}">
						{new Date(selectedDateKey.split('-')[0], selectedDateKey.split('-')[1] - 1, selectedDateKey.split('-')[2]).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
					</h3>
				</div>

				{#if selectedDayRuns.length === 0}
					<!-- Empty Selected Day View -->
					<div class="flex flex-col items-center justify-center py-10 space-y-3">
						<span class="text-3xl leading-none select-none {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-350'}">☺</span>
						<p class="text-xs text-center font-bold {preferences.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}">No irrigation scheduled for this day</p>
					</div>
				{:else}
					<!-- List of schedules for selected day -->
					<div class="space-y-3 pr-1">
						{#each selectedDayRuns as run}
							{@const isNote = run.zone.startsWith('Note:')}
							{@const isOriginalDayPlaceholder = run.postponedFromDateStr === selectedDateKey}
							{@const isRainAffected = isOriginalDayPlaceholder}
							<div 
								role="button"
								tabindex="0"
								onclick={() => handleDayClick(Number(selectedDateKey.split('-')[2]), selectedDateKey, selectedDayRuns)}
								onkeydown={(e) => e.key === 'Enter' && handleDayClick(Number(selectedDateKey.split('-')[2]), selectedDateKey, selectedDayRuns)}
								class="p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-xs {preferences.theme === 'dark' ? 'bg-slate-900/40 border border-slate-900/50 hover:bg-slate-900/60' : 'bg-slate-50 border border-slate-150 hover:bg-slate-100/75'}"
							>
								<!-- Colored vertical separator bar -->
								<div class={['w-1 rounded-full h-8 shrink-0', isRainAffected ? 'bg-blue-500' : (run.zone?.startsWith('Note:') ? (preferences.theme === 'dark' ? 'bg-white' : 'bg-slate-350') : (run.type === 'Fertilizer' ? 'bg-purple-500' : 'bg-primary-green'))].join(' ')}></div>

								<div class="flex-grow min-w-0">
									<p class="text-xs font-black truncate leading-snug {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">
										{isNote ? run.zone.substring(5).trim() : run.zone}
									</p>
									<p class="text-[9px] font-semibold mt-0.5 flex items-center gap-1 {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">
										<span class="material-symbols-outlined text-[10.5px]">schedule</span>
										<span>{run.time}</span>
									</p>
								</div>
								<div class="flex items-center gap-2">
									<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0" style="background-color: {isRainAffected ? '#3B82F6' : (run.type === 'Fertilizer' ? '#8B5CF6' : (run.type === 'Note' || isNote ? (preferences.theme === 'dark' ? '#FFFFFF' : '#E2E8F0') : '#16A34A'))}; color: {isRainAffected ? '#FFFFFF' : (run.type === 'Fertilizer' ? '#FFFFFF' : (run.type === 'Note' || isNote ? (preferences.theme === 'dark' ? '#000000' : '#475569') : '#FFFFFF'))}">
										{isRainAffected ? 'Rain Affected' : (run.type || 'Irrigation')}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Bottom CTA bar & floating button wrapper -->
				<div class="flex items-center justify-between gap-4 pt-4 border-t {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
					<!-- Pill button input style -->
					<button 
						onclick={() => openAddModalForDate(Number(selectedDateKey.split('-')[2]))}
						class="flex-1 text-xs font-bold py-2.5 px-4 rounded-full text-left transition-all cursor-pointer shadow-inner {preferences.theme === 'dark' ? 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800'}"
					>
						Add schedule on {new Date(selectedDateKey.split('-')[0], selectedDateKey.split('-')[1] - 1, selectedDateKey.split('-')[2]).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
					</button>

					<!-- Floating Round Button -->
					<button 
						onclick={() => openAddModalForDate(Number(selectedDateKey.split('-')[2]))}
						class="size-11 bg-primary-green hover:bg-dark-green text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-green/30 hover:scale-105 transition-all cursor-pointer"
						title="Add Schedule"
					>
						<span class="material-symbols-outlined text-2xl font-bold">add</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile Reference-style Day Details Popup/Bottom Sheet -->
		{#if showDayDetailsModal}
			<div 
				role="button"
				tabindex="0"
				class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 p-4 lg:hidden" 
				onclick={() => showDayDetailsModal = false}
				onkeydown={(e) => e.key === 'Escape' && (showDayDetailsModal = false)}
			>
				<div 
					role="presentation"
					class="w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-6 transform transition-transform duration-300 {preferences.theme === 'dark' ? 'bg-[#161616] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-850'}"
					onclick={(e) => e.stopPropagation()}
				>
					<!-- Bottom Sheet Header -->
					<div class="flex justify-between items-start border-b pb-3 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
						<div>
							<div class="flex items-baseline gap-2">
								<h3 class="text-3xl font-black tracking-tight leading-none">
									{selectedDateKey.split('-')[2]}
								</h3>
								<span class="text-sm font-bold {preferences.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}">
									{new Date(selectedDateKey.split('-')[0], selectedDateKey.split('-')[1] - 1, selectedDateKey.split('-')[2]).toLocaleDateString('en-US', { weekday: 'long' })}
								</span>
							</div>
							<p class="text-[10px] font-bold mt-2 {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">{selectedDateKey.split('-')[2]} {monthNames[currentMonth].substring(0, 3)}</p>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-xl leading-none select-none {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-350'}">☺</span>
							<button onclick={() => showDayDetailsModal = false} class="p-1 cursor-pointer {preferences.theme === 'dark' ? 'text-slate-450 hover:text-white' : 'text-slate-500 hover:text-slate-800'}">
								<span class="material-symbols-outlined text-xl">close</span>
							</button>
						</div>
					</div>

					<!-- Bottom Sheet Schedule List -->
					<div class="space-y-4 max-h-[300px] overflow-y-auto pr-1">
						{#each selectedDayRuns as run}
							{@const isNote = run.zone.startsWith('Note:')}
							{@const isOriginalDayPlaceholder = run.postponedFromDateStr === selectedDateKey}
							{@const isRainAffected = isOriginalDayPlaceholder}
							<div class="flex gap-4 items-start p-3 border rounded-2xl relative group/row {preferences.theme === 'dark' ? 'bg-slate-900/30 border-slate-900/60' : 'bg-slate-50 border-slate-150'}">
								<!-- Time -->
								<div class="text-[11px] font-black w-12 shrink-0 pt-0.5 leading-none {preferences.theme === 'dark' ? 'text-slate-350' : 'text-slate-500'}">
									{run.time.split(' ')[0]}
								</div>

								<!-- Colored vertical separator bar -->
								<div class={['w-1 rounded-full self-stretch shrink-0', isRainAffected ? 'bg-blue-500' : (run.zone?.startsWith('Note:') ? (preferences.theme === 'dark' ? 'bg-white' : 'bg-slate-350') : (run.type === 'Fertilizer' ? 'bg-purple-500' : 'bg-primary-green'))].join(' ')}></div>

								<!-- Info -->
								<div class="flex-grow min-w-0">
									<h5 class="text-xs font-black leading-snug truncate {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">
										{isNote ? run.zone.substring(5).trim() : run.zone}
									</h5>
									<p class="text-[9.5px] font-semibold mt-0.5 {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">
										{run.time}
									</p>
									{#if run.extensionDays > 0}
										<p class="text-[8.5px] font-bold text-sky-500 mt-1">
											☔ Postponed +{run.extensionDays}d due to forecast
										</p>
									{/if}
								</div>

								<!-- Status or Actions -->
								<div class="flex flex-col items-end gap-1.5 shrink-0">
									<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0" style="background-color: {isRainAffected ? '#3B82F6' : (run.type === 'Fertilizer' ? '#8B5CF6' : (run.type === 'Note' || isNote ? (preferences.theme === 'dark' ? '#FFFFFF' : '#E2E8F0') : '#16A34A'))}; color: {isRainAffected ? '#FFFFFF' : (run.type === 'Fertilizer' ? '#FFFFFF' : (run.type === 'Note' || isNote ? (preferences.theme === 'dark' ? '#000000' : '#475569') : '#FFFFFF'))}">
										{isRainAffected ? 'Rain Affected' : (run.type || 'Irrigation')}
									</span>
									{#if !isOriginalDayPlaceholder}
										<div class="flex gap-1.5 mt-1">
											{#if !isNote}
												<button 
													onclick={() => { showDayDetailsModal = false; openEditModal(run); }} 
													class="text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors cursor-pointer {preferences.theme === 'dark' ? 'text-slate-400 hover:text-white bg-slate-900 border-slate-800' : 'text-slate-600 hover:text-slate-800 bg-white border-slate-205'}"
												>
													Edit
												</button>
											{/if}
											<button 
												onclick={() => { deleteRun(run.id); if (selectedDayRuns.length <= 1) showDayDetailsModal = false; }} 
												class="text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors cursor-pointer {preferences.theme === 'dark' ? 'text-red-400 hover:text-red-300 bg-red-955/20 border-red-900/30' : 'text-red-600 hover:text-red-750 bg-red-50 border-red-100'}"
											>
												Delete
											</button>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Bottom Sheet Footer -->
					<div class="flex items-center justify-between gap-4 pt-4 border-t {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
						<button 
							onclick={() => { showDayDetailsModal = false; openAddModalForDate(Number(selectedDateKey.split('-')[2])); }}
							class="flex-grow text-xs font-bold py-2.5 px-4 rounded-full text-left transition-all cursor-pointer shadow-inner {preferences.theme === 'dark' ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800'}"
						>
							Add on {selectedDateKey.split('-')[2]} {monthNames[currentMonth].substring(0, 3)}
						</button>
						<button 
							onclick={() => { showDayDetailsModal = false; openAddModalForDate(Number(selectedDateKey.split('-')[2])); }}
							class="size-11 bg-primary-green hover:bg-dark-green text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-green/30 hover:scale-105 transition-all cursor-pointer"
							title="Add Schedule"
						>
							<span class="material-symbols-outlined text-2xl font-bold">add</span>
						</button>
					</div>
				</div>
			</div>
		{/if}


		<!-- Right Panel: Upcoming Runs and Weather Widget (4 cols) -->
		<div class="lg:col-span-4 space-y-6">
			<!-- Weather Widget Card overlaying field imagery -->
			<div class="relative h-60 rounded-2xl overflow-hidden glass-card group border-0 shadow-sm">
				<div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style='background-image: url("https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=500&q=80");'></div>
				<div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-0"></div>
				
				{#if weatherLoading}
					<div class="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-3 z-10 text-white">
						<div class="flex items-center gap-4">
							<div class="skeleton h-12 w-12 shrink-0 rounded-full bg-white/20"></div>
							<div class="flex flex-col gap-2">
								<div class="skeleton h-4 w-16 rounded bg-white/20"></div>
								<div class="skeleton h-4 w-24 rounded bg-white/20"></div>
							</div>
						</div>
						<div class="skeleton h-10 w-full rounded bg-white/20"></div>
					</div>
				{:else}
					<div class="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-1.5 z-10 text-white">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-white text-3xl filled">
								{activeRainToday > 40 ? 'cloudy_snowing' : 'sunny'}
							</span>
							<p class="text-3xl font-light">
								{weatherTempToday}°<span class="text-sm font-semibold">F</span>
							</p>
						</div>
						<p class="text-xs font-bold text-white/90">Precipitation: {activeRainToday}% today</p>
						<p class="text-[9px] font-black text-white/70 uppercase tracking-wider mt-1.5">Local Weather: {weatherLocation}</p>
					</div>
				{/if}
			</div>

			<!-- Upcoming Runs -->
			<div class="glass-card rounded-2xl p-6 space-y-5 bg-white">
				<div class="flex items-center justify-between">
					<h3 class="font-extrabold text-slate-800 text-base">Upcoming Runs</h3>
					<span class="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full">Weekly</span>
				</div>
				<div class="space-y-4">
					{#if loading || weatherLoading}
						<div class="flex w-full flex-col gap-4">
							<div class="flex items-center gap-4">
								<div class="skeleton h-12 w-12 shrink-0 rounded-2xl"></div>
								<div class="flex flex-col gap-3">
									<div class="skeleton h-4 w-20 rounded"></div>
									<div class="skeleton h-3 w-28 rounded"></div>
								</div>
							</div>
							<div class="skeleton h-14 w-full rounded-2xl"></div>
						</div>
					{:else}
						{#if computedUpcomingRuns.length === 0}
							<p class="text-xs text-slate-400 font-semibold text-center py-6">No upcoming activities</p>
						{:else}
							{#each computedUpcomingRuns as run (run.id)}
								<div class={['flex gap-3.5 items-center p-2.5 rounded-2xl transition-all border border-transparent', run.isToday ? 'bg-primary-green/5 border-primary-green/10 shadow-xs' : ''].filter(Boolean).join(' ')}>
									<div class="size-10 rounded-xl bg-slate-50 border border-slate-150 flex flex-col items-center justify-center shrink-0 relative">
										<span class="text-slate-700 text-xs font-black leading-none">
											{run.dateStr.split(' ')[1].replace(',', '')}
										</span>
										<span class="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
											{run.dateStr.split(' ')[0]}
										</span>
										<span class="absolute -bottom-1.5 -right-1.5 size-5 bg-white rounded-full flex items-center justify-center text-[10.5px] border border-slate-150 shadow-xs" title={run.zone}>
											{getCropEmoji(run.zone)}
										</span>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-1.5">
											<span class="px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase text-white" style="background-color: {run.type === 'Fertilizer' ? '#8B5CF6' : (run.type === 'Note' ? '#F59E0B' : '#10B981')}">
												{run.type}
											</span>
											<p class="text-[11.5px] font-bold text-slate-800 truncate leading-snug">
												{run.zone.startsWith('Note:') ? run.zone.substring(5).trim() : run.zone}
											</p>
										</div>
										<p class="text-[9.5px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
											<span class="material-symbols-outlined text-[10px] text-slate-350">schedule</span>
											<span>{run.time}</span>
										</p>
									</div>
									<div class="text-right shrink-0">
										{#if run.isToday}
											<span class="px-2 py-0.5 bg-emerald-100 text-dark-green text-[8px] font-black rounded-full uppercase tracking-wider animate-pulse">Today</span>
										{:else}
											<span class="text-[9px] text-slate-450 font-bold bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-md">{run.daysRemaining}d left</span>
										{/if}
									</div>
								</div>
							{/each}
						{/if}
					{/if}
				</div>
			</div>
		</div>

	</div>

	<!-- Day Schedule Details Modal (Mobile Bottom Sheet / Desktop Modal) -->
	<Modal 
		bind:show={showDayDetailsModal} 
		size="md" 
		title="Day Schedule Details"
	>
		<div class="space-y-4 text-xs font-semibold text-slate-700">
			<!-- Date Header inside content -->
			<div class="flex items-center justify-between border-b border-slate-100 pb-3">
				<div>
					<h4 class="text-sm font-black text-slate-900">
						{new Date(selectedDateKey.split('-')[0], selectedDateKey.split('-')[1] - 1, selectedDateKey.split('-')[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
					</h4>
					<p class="text-[10px] font-bold text-slate-400 mt-0.5">{selectedDayRuns.length} schedule{selectedDayRuns.length === 1 ? '' : 's'} scheduled</p>
				</div>
			</div>

			<div class="space-y-3 max-h-96 overflow-y-auto pr-1">
				{#if selectedDayRuns.length === 0}
					<div class="text-center py-8 text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
						<span class="material-symbols-outlined text-[32px] text-slate-300">water_drop</span>
						<span>No irrigation scheduled for this day</span>
					</div>
				{:else}
					{#each selectedDayRuns as run}
						{@const isNote = run.zone.startsWith('Note:')}
						{@const isOriginalDayPlaceholder = run.postponedFromDateStr === selectedDateKey}
						{@const isRainAffected = isOriginalDayPlaceholder}
						<div class="flex gap-4 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl relative shadow-xs">
							<!-- Time -->
							<div class="text-[11px] font-black text-slate-500 w-12 shrink-0 pt-0.5 leading-none">
								{run.time.split(' ')[0]}
							</div>

							<!-- Colored vertical separator bar -->
							<div class={['w-1 rounded-full self-stretch shrink-0', isRainAffected ? 'bg-blue-500' : (run.zone?.startsWith('Note:') ? 'bg-slate-350' : (run.type === 'Fertilizer' ? 'bg-purple-500' : 'bg-primary-green'))].join(' ')}></div>

							<!-- Info -->
							<div class="flex-grow min-w-0">
								<h5 class="text-xs font-black leading-snug text-slate-800 truncate">
									{isNote ? run.zone.substring(5).trim() : run.zone}
								</h5>
								<p class="text-[9.5px] font-semibold text-slate-400 mt-0.5">
									{run.time}
								</p>
								{#if run.extensionDays > 0}
									<p class="text-[8.5px] font-bold text-sky-655 mt-1">
										☔ Postponed +{run.extensionDays}d due to forecast
									</p>
								{/if}
							</div>

							<!-- Status or Actions -->
							<div class="flex flex-col items-end gap-1.5 shrink-0">
								<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0" style="background-color: {isRainAffected ? '#3B82F6' : (run.type === 'Fertilizer' ? '#8B5CF6' : (run.type === 'Note' || isNote ? '#E2E8F0' : '#16A34A'))}; color: {isRainAffected ? '#FFFFFF' : (run.type === 'Fertilizer' ? '#FFFFFF' : (run.type === 'Note' || isNote ? '#475569' : '#FFFFFF'))}">
									{isRainAffected ? 'Rain Affected' : (run.type || 'Irrigation')}
								</span>
								{#if !isOriginalDayPlaceholder}
									<div class="flex gap-1.5 mt-1">
										{#if !isNote}
											<button 
												onclick={(e) => { e.stopPropagation(); showDayDetailsModal = false; openEditModal(run); }} 
												class="text-[9px] font-black text-slate-500 hover:text-slate-900 px-1.5 py-0.5 rounded bg-white border border-slate-200 transition-colors cursor-pointer"
											>
												Edit
											</button>
										{/if}
										<button 
											onclick={(e) => { e.stopPropagation(); deleteRun(run.id); if (selectedDayRuns.length <= 1) showDayDetailsModal = false; }} 
											class="text-[9px] font-black text-red-500 hover:text-red-655 px-1.5 py-0.5 rounded bg-red-50 border border-red-100 transition-colors cursor-pointer"
										>
											Delete
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		{#snippet footer()}
			<button 
				type="button" 
				onclick={() => { showDayDetailsModal = false; openAddModalForDate(Number(selectedDateKey.split('-')[2])); }}
				class="btn-primary w-full py-3 text-xs cursor-pointer flex items-center justify-center gap-1.5"
			>
				<span class="material-symbols-outlined text-sm">add</span>
				<span>Add Schedule on this Date</span>
			</button>
		{/snippet}
	</Modal>

	<!-- Edit Schedule Modal -->
	<Modal 
		bind:show={editModalActive} 
		size="md" 
		title={`Edit Schedule Series`}
		onSubmit={handleEditSchedule}
	>
		{#if editingSchedule}
			<div class="space-y-4 text-xs font-semibold text-slate-700">
				<!-- Event Type -->
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Event Type</span>
					<select bind:value={editType} class="input-field w-full text-xs">
						<option value="Irrigation">Irrigation</option>
						<option value="Fertilizer">Fertilizer</option>
						<option value="Note">Note</option>
					</select>
				</label>

				<!-- Crop / Zone Name -->
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
						{editType === 'Note' ? 'Note Description' : 'Crop / Zone Name'}
					</span>
					<input type="text" bind:value={editZone} required placeholder="e.g. Dragon Fruit" class="input-field w-full text-xs" />
				</label>

				<div class="grid grid-cols-2 gap-4">
					<label class="block col-span-2">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Start Date</span>
						<input type="date" bind:value={editStartDateStr} required class="input-field w-full text-xs" />
					</label>
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Interval (Days)</span>
						<input type="number" min="1" bind:value={editIntervalDays} required={editType !== 'Note'} disabled={editType === 'Note'} class="input-field w-full text-xs" />
					</label>
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Time Block</span>
						<input type="text" bind:value={editTime} required={editType !== 'Note'} class="input-field w-full text-xs" />
					</label>
				</div>

				{#if error}
					<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
						⚠️ {error}
					</div>
				{/if}
			</div>
		{/if}

		{#snippet footer()}
			<button type="button" onclick={() => editModalActive = false} class="btn-secondary flex-1 py-3 text-xs cursor-pointer">Cancel</button>
			<button type="submit" disabled={loading} class="btn-primary flex-1 py-3 text-xs cursor-pointer">
				{loading ? 'Saving...' : 'Save Changes'}
			</button>
		{/snippet}
	</Modal>

	<!-- Manage Schedules Modal -->
	<Modal 
		bind:show={manageModalActive} 
		size="lg" 
		title="Manage Repeating Schedules & Activities"
	>
		<div class="space-y-4 text-xs font-semibold text-slate-700">
			<div class="flex items-center justify-between border-b border-slate-100 pb-3">
				<p class="text-slate-400 font-semibold leading-relaxed">
					Review, edit, or delete repeating schedules series currently configured for your farm.
				</p>
				{#if scheduleRuns.length > 0}
					<button 
						onclick={clearAll}
						class="border border-red-200 text-red-650 hover:bg-red-50/50 font-bold text-[10px] px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0"
						title="Clear all events and weather overrides"
					>
						<span class="material-symbols-outlined text-[12px]">delete_sweep</span>
						<span>Clear All Data</span>
					</button>
				{/if}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
				{#if uniqueSchedules.length === 0}
					<div class="col-span-full text-center py-8 text-slate-400 font-semibold">
						No active schedules configured yet. Click "Add Schedules" in the header to get started.
					</div>
				{:else}
					{#each uniqueSchedules as sched}
						<div class="flex flex-col justify-between p-4.5 rounded-2xl border border-slate-200/60 bg-white hover:border-primary-green/30 transition-all text-xs font-bold shadow-xs hover:shadow-md hover:shadow-slate-100/50 space-y-3.5 relative">
							<!-- Header: Category and Actions -->
							<div class="flex items-start justify-between gap-3">
								<span class="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase text-white tracking-wider" style="background-color: {sched.type === 'Fertilizer' ? '#8B5CF6' : (sched.type === 'Note' ? '#F59E0B' : '#10B981')}">
									{sched.type || 'Irrigation'}
								</span>
								
								<div class="flex items-center gap-1.5">
									<button 
										onclick={() => { manageModalActive = false; openEditModal(sched); }}
										class="size-7 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-primary-green transition-all cursor-pointer border border-slate-100 hover:border-emerald-100"
										title="Edit schedule series"
									>
										<span class="material-symbols-outlined text-[15px]">edit</span>
									</button>
									<button 
										onclick={() => handleDeleteSchedule(sched)}
										class="size-7 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer border border-slate-100 hover:border-red-100"
										title="Delete schedule series"
									>
										<span class="material-symbols-outlined text-[15px]">delete</span>
									</button>
								</div>
							</div>

							<!-- Body: Activity Name -->
							<div>
								<h4 class="text-[13px] font-black text-slate-900 leading-tight truncate">
									{sched.zone.startsWith('Note:') ? sched.zone.substring(5).trim() : sched.zone}
								</h4>
								<p class="text-slate-400 font-semibold text-[10px] flex items-center gap-1 mt-1 leading-none">
									<span class="material-symbols-outlined text-[12px] text-slate-350">schedule</span>
									<span>Time: {sched.time}</span>
								</p>
							</div>

							<!-- Details Grid -->
							<div class="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
								<div>
									<span class="block text-[8px] font-bold uppercase tracking-wider text-slate-405">Interval</span>
									<span class="block mt-0.5 text-slate-700 font-black truncate">Every {sched.intervalDays}d</span>
								</div>
								<div>
									<span class="block text-[8px] font-bold uppercase tracking-wider text-slate-405">Start Date</span>
									<span class="block mt-0.5 text-slate-700 font-black truncate">{sched.startDateFormatted}</span>
								</div>
								<div>
									<span class="block text-[8px] font-bold uppercase tracking-wider text-slate-405">Next Run</span>
									<span class="block mt-0.5 text-primary-green font-black truncate">{sched.nextRunStr}</span>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		{#snippet footer()}
			<button type="button" onclick={() => manageModalActive = false} class="btn-secondary w-full py-3 text-xs cursor-pointer">Close Manager</button>
		{/snippet}
	</Modal>
</section>

