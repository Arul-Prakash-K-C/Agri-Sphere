<script>
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';

	let { data } = $props();

	let scheduleRuns = $state([]);
	let upcomingRuns = $state([]);
	let activities = $state([]);
	let weatherOverrides = $state({});

	// Manual override valves state
	let valveStateZone1 = $state(false);
	let valveStateZone2 = $state(false);
	let valveStateZone3 = $state(false);

	// Sync data on page load or update
	$effect(() => {
		scheduleRuns = data.scheduleRuns || [];
		upcomingRuns = data.upcomingRuns || [];
		activities = data.activities || [];
		weatherOverrides = data.weatherOverrides || {};
		
		// Set values without triggering the save effect
		valveStateZone1 = !!data.valves?.zone1;
		valveStateZone2 = !!data.valves?.zone2;
		valveStateZone3 = !!data.valves?.zone3;
	});

	let activeTab = $state('schedule'); // 'schedule' | 'health' | 'manual'
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
	let isCustomNote = $state(false);
	let customNoteText = $state('');
	let newZone = $state('Dragon Fruit');
	let newStartDateStr = $state('');
	let newEndDateStr = $state('');
	let newIntervalDays = $state(1);
	let clickedDay = $state(1);
	let newTime = $state('05:00 - 06:00');

	const pad = (n) => String(n).padStart(2, '0');

	let weatherLocation = $state('Napa Valley');
	let weatherTempToday = $state(82);
	let weatherPrecipitationToday = $state(0);
	let dailyPrecipitation = $state({});

	let locationSearchInput = $state(data.profile?.address || 'Napa Valley');
	let activeWeatherAddress = $state(data.profile?.address || 'Napa Valley');
	let detectingLocation = $state(false);

	let overrideRainProbability = $state(0);
	let overrideDidRain = $state(false);
	let modalActiveTab = $state('event'); // 'event' | 'weather'
	let weatherLoading = $state(false);

	let activeRainToday = $derived(
		weatherOverrides[`${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`] 
			? weatherOverrides[`${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`].rainProbability 
			: weatherPrecipitationToday
	);

	async function updateLocationWeather(address) {
		if (!address || address.trim().length === 0) return;
		weatherLoading = true;
		
		let lat = 38.2975;
		let lon = -122.2869;
		let resolvedLocationName = address;

		const coordRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
		const match = address.trim().match(coordRegex);

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
				console.error('Frontend geocoding error:', e);
			}
		}

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
			console.error('Frontend weather fetch error:', e);
		} finally {
			weatherLoading = false;
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
		updateLocationWeather(activeWeatherAddress);
	});

	let loading = $state(false);
	let error = $state('');

	function openAddModalForDate(day) {
		clickedDay = day;
		const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
		newStartDateStr = dateStr;
		newEndDateStr = dateStr;
		newIntervalDays = 1;
		isCustomNote = false;
		customNoteText = '';
		newZone = 'Dragon Fruit';
		newTime = '05:00 - 06:00';
		error = '';
		modalActiveTab = 'event';

		const dateKey = dateStr;
		if (weatherOverrides[dateKey]) {
			overrideRainProbability = weatherOverrides[dateKey].rainProbability;
			overrideDidRain = weatherOverrides[dateKey].didRain;
		} else {
			overrideRainProbability = dailyPrecipitation[dateKey] || 0;
			overrideDidRain = false;
		}

		showAddModal = true;
	}

	async function handleAddRun(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const displayZone = isCustomNote ? `Note: ${customNoteText}` : newZone;
		const displayTime = isCustomNote && !newTime ? 'All Day' : (newTime || '05:00 - 06:00');

		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'add_run',
					payload: {
						zone: displayZone,
						startDateStr: newStartDateStr,
						endDateStr: newEndDateStr,
						intervalDays: Number(newIntervalDays),
						time: displayTime,
						location: activeWeatherAddress
					}
				})
			});

			if (!res.ok) {
				const resData = await res.json();
				throw new Error(resData.error || 'Failed to add schedule item');
			}

			const result = await res.json();
			scheduleRuns = [...scheduleRuns, ...result.runs];
			if (result.activities) activities = result.activities;
			if (result.upcomingRuns) upcomingRuns = result.upcomingRuns;

			// Clear form & close
			isCustomNote = false;
			customNoteText = '';
			newZone = 'Dragon Fruit';
			newStartDateStr = '';
			newEndDateStr = '';
			newIntervalDays = 1;
			newTime = '05:00 - 06:00';
			showAddModal = false;
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
						didRain: overrideDidRain
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

	// Save valves state whenever a toggle changes
	async function saveValves() {
		try {
			const res = await fetch('/api/irrigation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_valves',
					payload: {
						valves: {
							zone1: valveStateZone1,
							zone2: valveStateZone2,
							zone3: valveStateZone3
						}
					}
				})
			});
			if (res.ok) {
				const result = await res.json();
				if (result.activities) {
					activities = result.activities;
				}
			}
		} catch (err) {
			console.error('Error saving valves state:', err);
		}
	}

	// Interactive calendar hover highlights
	let hoveredCell = $state(null);
</script>

<svelte:head>
	<title>Irrigation Control - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header & Actions -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">💧</span> Irrigation Control
			</h1>
			<p class="text-sm text-slate-500 mt-1">Monitor and schedule water distribution zones.</p>
		</div>
		<button 
			onclick={() => openAddModalForDate(1)}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
		>
			<span class="material-symbols-outlined text-[18px]">calendar_today</span>
			<span>Schedule New Run / Note</span>
		</button>
	</div>

	<!-- Add Run / Note Modal -->
	{#if showAddModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
						<span class="material-symbols-outlined text-primary-green text-lg">
							{modalActiveTab === 'weather' ? 'wb_sunny' : 'event_note'}
						</span>
						<span>{modalActiveTab === 'weather' ? `Adjust Weather (${monthNames[currentMonth].substring(0, 3)} ${clickedDay})` : (isCustomNote ? 'Add Calendar Note' : 'Schedule Irrigation Event')}</span>
					</h3>
					<button onclick={() => showAddModal = false} class="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 flex items-center cursor-pointer">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>

				<!-- Modal Tabs -->
				<div class="flex gap-4 border-b border-slate-100 py-2.5 text-[10px] font-bold uppercase tracking-wider">
					<button 
						type="button"
						onclick={() => modalActiveTab = 'event'}
						class={['pb-1 transition-all border-b-2', 
							modalActiveTab === 'event' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
					>
						Schedule Event / Note
					</button>
					<button 
						type="button"
						onclick={() => modalActiveTab = 'weather'}
						class={['pb-1 transition-all border-b-2', 
							modalActiveTab === 'weather' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
					>
						Adjust Weather
					</button>
				</div>

				{#if modalActiveTab === 'event'}
					<form onsubmit={handleAddRun} class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
						
						<!-- Event Type Toggle -->
						<div class="space-y-1">
							<span class="block mb-1 text-slate-500">Event Type</span>
							<div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
								<button 
									type="button" 
									onclick={() => { isCustomNote = false; newTime = '05:00 - 06:00'; }} 
									class={['py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer', !isCustomNote ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
								>
									Watering Zone
								</button>
								<button 
									type="button" 
									onclick={() => { isCustomNote = true; newTime = ''; }} 
									class={['py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer', isCustomNote ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
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

						{#if !isCustomNote}
							<label class="block">
								<span class="block mb-1">Crop / Zone Name</span>
								<input type="text" bind:value={newZone} required placeholder="e.g. Dragon Fruit, North Orchard" class="input-field w-full text-xs" />
							</label>
						{:else}
							<label class="block">
								<span class="block mb-1">Note Description</span>
								<textarea bind:value={customNoteText} required placeholder="e.g. Clean zone sprinkler heads, record soil moisture, inspect pipeline..." class="input-field w-full text-xs" rows="2"></textarea>
							</label>
						{/if}

						<div class="grid grid-cols-2 gap-4">
							<label class="block">
								<span class="block mb-1">Start Date</span>
								<input type="date" bind:value={newStartDateStr} required class="input-field w-full text-xs" />
							</label>
							<label class="block">
								<span class="block mb-1">End Date</span>
								<input type="date" min={newStartDateStr} bind:value={newEndDateStr} required class="input-field w-full text-xs" />
							</label>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<label class="block">
								<span class="block mb-1">Interval (Days)</span>
								<input type="number" min="1" bind:value={newIntervalDays} required={!isCustomNote} disabled={isCustomNote} placeholder="e.g. 1 (every day)" class="input-field w-full text-xs" />
							</label>
							<label class="block">
								<span class="block mb-1">Time Block</span>
								<input type="text" bind:value={newTime} required={!isCustomNote} placeholder={isCustomNote ? "e.g. All Day (optional)" : "e.g. 05:00 - 06:00"} class="input-field w-full text-xs" />
							</label>
						</div>

						{#if error}
							<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
								⚠️ {error}
							</div>
						{/if}

						<div class="flex gap-3 pt-3 border-t border-slate-100">
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
								{loading ? 'Adding...' : 'Add Item'}
							</button>
						</div>
					</form>
				{:else}
					<!-- Weather Override Form -->
					<form onsubmit={handleSaveWeatherOverride} class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
						<div class="rounded-xl bg-slate-50 border border-slate-200/50 p-3 flex flex-col gap-2 text-slate-500">
							<span class="font-bold flex items-center gap-1 text-[10px] text-slate-650">
								<span class="material-symbols-outlined text-amber-500 text-[14px]">wb_sunny</span>
								Manual Weather Controls
							</span>
							<p class="text-[9px] font-normal leading-normal">
								Adjust this specific date's weather properties if the live forecast is incorrect. Existing scheduled irrigation runs on this day will automatically recalculate and adjust.
							</p>
						</div>

						<div class="space-y-1">
							<span class="block text-slate-500">Precipitation Probability ({overrideRainProbability}%)</span>
							<div class="flex items-center gap-4">
								<input 
									type="range" 
									min="0" 
									max="100" 
									step="10" 
									bind:value={overrideRainProbability}
									class="flex-1 accent-primary-green h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
								/>
								<input 
									type="number" 
									min="0" 
									max="100" 
									step="10" 
									bind:value={overrideRainProbability} 
									class="w-14 text-center bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs text-slate-700" 
								/>
							</div>
						</div>

						<!-- Did it Rain Toggle -->
						<div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
							<div>
								<span class="block text-[11px] font-bold text-slate-800">Did it Rain?</span>
								<span class="block text-[9px] font-normal text-slate-400 font-medium">Specify if rain actually occurred on this day</span>
							</div>
							<label class="relative inline-flex items-center cursor-pointer select-none">
								<input type="checkbox" bind:checked={overrideDidRain} class="sr-only peer" />
								<div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-green"></div>
							</label>
						</div>

						{#if error}
							<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
								⚠️ {error}
							</div>
						{/if}

						<div class="flex gap-3 pt-3 border-t border-slate-100">
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
								{loading ? 'Saving...' : 'Save Adjustments'}
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Summary Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="glass-card rounded-2xl p-6 flex flex-col gap-3 border-l-4 border-l-primary-green">
			<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weekly Water Usage</p>
			<div class="flex items-baseline gap-2">
				<p class="text-3xl font-black text-slate-800">450 <span class="text-sm font-bold text-slate-400">gal</span></p>
				<span class="text-red-500 text-xs font-bold flex items-center">
					<span class="material-symbols-outlined text-sm">trending_up</span> 5%
				</span>
			</div>
			<div class="w-full bg-slate-100 rounded-full h-1.5 mt-2">
				<div class="bg-primary-green h-1.5 rounded-full" style="width: 65%"></div>
			</div>
		</div>

		<div class="glass-card rounded-2xl p-6 flex flex-col gap-3 border-l-4 border-l-primary-green">
			<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Health</p>
			<p class="text-2xl font-black text-slate-800">All Zones Active</p>
			<div class="flex items-center gap-1.5">
				<span class="size-2 bg-primary-green rounded-full animate-pulse"></span>
				<p class="text-primary-green text-xs font-bold">Online & Optimizing</p>
			</div>
		</div>

		<div class="glass-card rounded-2xl p-6 flex flex-col gap-3 border-l-4 border-l-amber-500">
			<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Savings</p>
			<div class="flex items-baseline gap-2">
				<p class="text-3xl font-black text-slate-800">15%</p>
				<span class="text-primary-green text-xs font-bold flex items-center">
					<span class="material-symbols-outlined text-sm">trending_down</span> 2%
				</span>
			</div>
			{#if activeRainToday > 0}
				<p class="text-slate-500 text-xs leading-relaxed">System adjusted for weather forecast: {activeRainToday}% rain probability today.</p>
			{:else}
				<p class="text-slate-500 text-xs leading-relaxed">No rain forecast today. Optimal watering scheduled.</p>
			{/if}
		</div>
	</div>

	<!-- Main Body Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Left Panel: Interactive Schedule and Override Tabs (8 cols) -->
		<div class="lg:col-span-8 space-y-6">
			<!-- Navigation Tabs -->
			<div class="flex border-b border-slate-200 gap-8">
				<button 
					onclick={() => activeTab = 'schedule'}
					class={['pb-4 px-1 font-bold text-xs tracking-wider transition-all border-b-2', 
						activeTab === 'schedule' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
				>
					IRRIGATION SCHEDULE
				</button>
				<button 
					onclick={() => activeTab = 'health'}
					class={['pb-4 px-1 font-bold text-xs tracking-wider transition-all border-b-2', 
						activeTab === 'health' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
				>
					SYSTEM HEALTH
				</button>
				<button 
					onclick={() => activeTab = 'manual'}
					class={['pb-4 px-1 font-bold text-xs tracking-wider transition-all border-b-2', 
						activeTab === 'manual' ? 'border-primary-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'].filter(Boolean).join(' ')}
				>
					MANUAL OVERRIDE
				</button>
			</div>

			<!-- Tab contents -->
			{#if activeTab === 'schedule'}
				<div transition:fade={{ duration: 100 }} class="glass-card rounded-2xl overflow-hidden bg-white">
					<div class="p-6 border-b border-slate-100 flex items-center justify-between">
						<h3 class="font-extrabold text-slate-850 text-base">{monthNames[currentMonth]} {currentYear}</h3>
						<div class="flex gap-2">
							<button onclick={prevMonth} class="size-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer" title="Previous Month">
								<span class="material-symbols-outlined text-base">chevron_left</span>
							</button>
							<button onclick={nextMonth} class="size-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer" title="Next Month">
								<span class="material-symbols-outlined text-base">chevron_right</span>
							</button>
						</div>
					</div>
					
					<!-- Calendar Grid -->
					<div class="grid grid-cols-7 bg-slate-50/50">
						<!-- Day Headers -->
						{#each ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as day}
							<div class="p-3 text-center text-[10px] font-black text-slate-400 border-r border-b border-slate-100">{day}</div>
						{/each}

						<!-- Empty Cells for previous month alignment -->
						{#each Array.from({ length: firstDayIndex }) as _}
							<div class="min-h-[110px] border-r border-b border-slate-100 bg-slate-50/10"></div>
						{/each}

						<!-- Days of current month -->
						{#each Array.from({ length: totalDaysInMonth }) as _, index}
							{@const dateNumber = index + 1}
							{@const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(dateNumber)}`}
							{@const override = weatherOverrides[dateKey]}
							{@const rainChance = override ? override.rainProbability : (dailyPrecipitation[dateKey] || 0)}
							{@const didItRain = override ? override.didRain : false}
							{@const cellRuns = scheduleRuns.filter(r => 
								r.date === dateNumber && 
								Number(r.month ?? 9) === currentMonth && 
								Number(r.year ?? 2023) === currentYear
							)}
							
							<div 
								role="gridcell"
								tabindex="-1"
								onclick={() => openAddModalForDate(dateNumber)}
								onmouseenter={() => hoveredCell = dateNumber}
								onmouseleave={() => hoveredCell = null}
								class={['min-h-[110px] p-3 border-r border-b border-slate-100 flex flex-col justify-between transition-colors relative cursor-pointer group hover:bg-slate-50/50',
									hoveredCell === dateNumber ? 'bg-slate-50' : 'bg-white',
									(dateNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear) ? 'bg-emerald-50/40 border-primary-green/30' : ''
								].filter(Boolean).join(' ')}
							>
								<div class="flex justify-between items-center w-full">
									<span class={['text-[11px] font-bold', (dateNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear) ? 'text-primary-green font-black underline decoration-2 underline-offset-2' : 'text-slate-400'].filter(Boolean).join(' ')}>
										{dateNumber}
									</span>
									<div class="flex items-center gap-1">
										{#if rainChance > 0 || didItRain}
											<span 
												class={['text-[8px] font-black flex items-center gap-0.5', didItRain ? 'text-sky-700 bg-sky-100/50 px-1.5 py-0.5 rounded-md border border-sky-200/30' : 'text-sky-600'].filter(Boolean).join(' ')} 
												title={didItRain ? `Manual override: Rained (${rainChance}%)` : `Rain probability: ${rainChance}%`}
											>
												<span class="material-symbols-outlined text-[10px] text-sky-500 fill-1">
													{didItRain ? 'umbrella' : 'rainy'}
												</span>
												{didItRain ? 'Rained' : `${rainChance}%`}
											</span>
										{/if}
										<span class="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary-green transition-opacity">add</span>
									</div>
								</div>
								
								{#if cellRuns.length > 0}
									<div class="space-y-1.5 mt-2 w-full">
										{#each cellRuns as run}
											<div class={['p-1.5 rounded-lg text-[9px] font-extrabold border shadow-sm leading-tight break-words', run.colorClass].filter(Boolean).join(' ')}>
												{#if run.zone.startsWith('Note:')}
													<div class="flex items-start gap-1 text-slate-800">
														<span class="material-symbols-outlined text-[10px] shrink-0 mt-0.5 text-amber-600">description</span>
														<div class="flex-1">
															<span>{run.zone.substring(5).trim()}</span>
															<div class="font-normal opacity-85 mt-0.5 text-[8px]">{run.time}</div>
														</div>
													</div>
												{:else}
													<div class="flex items-center justify-between gap-1">
														<span class="font-black text-slate-800 truncate">{run.zone}</span>
														{#if run.extensionDays > 0}
															<span class="text-[8px] text-sky-600 flex items-center cursor-help shrink-0" title="Shifted +{run.extensionDays}d due to {run.rainProbability}% rain forecast on original date.">☔</span>
														{/if}
													</div>
													{#if run.extensionDays > 0}
														<div class="text-[8px] text-sky-700 font-bold mt-0.5">
															Postponed +{run.extensionDays}d ({run.rainProbability}% Rain)
														</div>
													{/if}
													<div class="font-normal opacity-80 mt-0.5 text-[8px]">{run.time}</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}

						<!-- Additional empty cells to finish grid rows -->
						{#each Array.from({ length: remainingCells }) as _}
							<div class="min-h-[110px] border-r border-b border-slate-100 bg-slate-50/10"></div>
						{/each}
					</div>
				</div>

			{:else}
				<!-- System Health / Manual Override content -->
				<div transition:fade={{ duration: 100 }} class="glass-card rounded-2xl p-6 bg-white space-y-6">
					{#if activeTab === 'health'}
						<h3 class="font-extrabold text-slate-800 text-base mb-4">Sprinkler Valve Status</h3>
						<div class="grid gap-4 md:grid-cols-2">
							{#each ['Zone 1: North Orchard', 'Zone 2: Berries', 'Zone 3: Greenhouses', 'Zone 4: Vineyard'] as zone, idx}
								<div class="border border-slate-100 rounded-2xl p-4 flex justify-between items-center bg-slate-50/50">
									<div>
										<h4 class="font-bold text-slate-800">{zone}</h4>
										<p class="text-[10px] text-slate-400 font-bold mt-1 uppercase">Signal: Good • Pressure: 42 PSI</p>
									</div>
									<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-dark-green text-[10px] font-bold border border-emerald-100">
										Active
									</span>
								</div>
							{/each}
						</div>
					{:else}
						<h3 class="font-extrabold text-slate-800 text-base mb-4">Manual Valve Controls</h3>
						<p class="text-xs text-slate-500 mb-6">Manually trigger irrigation zones. These timers run for a default 15 minutes safety limit.</p>
						<div class="space-y-4">
							<div class="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
								<div>
									<h4 class="font-bold text-slate-800">Zone 1: North Orchard</h4>
									<p class="text-[10px] text-slate-400 mt-1 font-bold uppercase">Status: {valveStateZone1 ? 'Irrigating' : 'Idle'}</p>
								</div>
								<button 
									onclick={() => { valveStateZone1 = !valveStateZone1; saveValves(); }}
									class={['px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all',
										valveStateZone1 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary-green text-white hover:bg-dark-green'].filter(Boolean).join(' ')}
								>
									{valveStateZone1 ? 'STOP WATER' : 'START WATER'}
								</button>
							</div>

							<div class="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
								<div>
									<h4 class="font-bold text-slate-800">Zone 2: Berries</h4>
									<p class="text-[10px] text-slate-400 mt-1 font-bold uppercase">Status: {valveStateZone2 ? 'Irrigating' : 'Idle'}</p>
								</div>
								<button 
									onclick={() => { valveStateZone2 = !valveStateZone2; saveValves(); }}
									class={['px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all',
										valveStateZone2 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary-green text-white hover:bg-dark-green'].filter(Boolean).join(' ')}
								>
									{valveStateZone2 ? 'STOP WATER' : 'START WATER'}
								</button>
							</div>

							<div class="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
								<div>
									<h4 class="font-bold text-slate-800">Zone 3: Greenhouses</h4>
									<p class="text-[10px] text-slate-400 mt-1 font-bold uppercase">Status: {valveStateZone3 ? 'Irrigating' : 'Idle'}</p>
								</div>
								<button 
									onclick={() => { valveStateZone3 = !valveStateZone3; saveValves(); }}
									class={['px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all',
										valveStateZone3 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary-green text-white hover:bg-dark-green'].filter(Boolean).join(' ')}
								>
									{valveStateZone3 ? 'STOP WATER' : 'START WATER'}
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Right Panel: Upcoming Runs and Weather Widget (4 cols) -->
		<div class="lg:col-span-4 space-y-6">
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
						{#each upcomingRuns as run (run.id)}
							<div class="flex gap-4 items-center">
								<div class="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shrink-0">
									<p class="text-[9px] font-black text-slate-400 leading-none">{monthNames[run.month !== undefined ? run.month : currentMonth].substring(0, 3).toUpperCase()}</p>
									<p class="text-base font-black text-slate-800 leading-none mt-1">{run.day}</p>
								</div>
								<div>
									<p class="text-xs font-bold text-slate-850 leading-tight">{run.zone}</p>
									<p class="text-[10px] text-slate-400 font-semibold mt-1">{run.details}</p>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Recent Activities -->
			<div class="glass-card rounded-2xl p-6 space-y-5 bg-white">
				<h3 class="font-extrabold text-slate-800 text-base">Recent Activity</h3>
				<div class="relative space-y-6">
					{#if loading || weatherLoading}
						<div class="flex w-full flex-col gap-4">
							<div class="flex items-center gap-4">
								<div class="skeleton h-10 w-10 shrink-0 rounded-full"></div>
								<div class="flex flex-col gap-3">
									<div class="skeleton h-4 w-16 rounded"></div>
									<div class="skeleton h-3 w-24 rounded"></div>
								</div>
							</div>
						</div>
					{:else}
						<!-- Timeline vertical connector -->
						<div class="absolute left-5 top-2 bottom-2 w-[1.5px] bg-slate-100"></div>

						{#each activities as act (act.id)}
							<div class="flex gap-4 items-center relative z-10">
								<div class={['size-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-slate-100/50', act.colorClass].filter(Boolean).join(' ')}>
									<span class="material-symbols-outlined text-[16px]">{act.icon}</span>
								</div>
								<div>
									<p class="text-xs font-bold text-slate-800 leading-tight">{act.title}</p>
									<p class="text-[10px] text-slate-400 font-semibold mt-1">{act.desc}</p>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Location Selector -->
			<div class="glass-card rounded-2xl p-6 bg-white space-y-4 shadow-sm border border-slate-100">
				<div class="flex items-center justify-between">
					<h3 class="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
						<span class="material-symbols-outlined text-primary-green text-[18px]">location_on</span>
						<span>Select Monitor Location</span>
					</h3>
				</div>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input 
							type="text" 
							placeholder="Search city, farm zone or region..." 
							bind:value={locationSearchInput}
							onkeydown={(e) => e.key === 'Enter' && updateLocationWeather(locationSearchInput)}
							class="w-full pl-9 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:border-primary-green transition-all"
						/>
						<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
						<button 
							onclick={() => updateLocationWeather(locationSearchInput)}
							class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary-green text-white text-[10px] font-bold rounded-lg hover:bg-dark-green transition-all cursor-pointer"
						>
							GO
						</button>
					</div>
					<button 
						type="button"
						onclick={detectBrowserLocation}
						disabled={detectingLocation}
						class="px-3 bg-emerald-50 hover:bg-emerald-100 text-primary-green border border-emerald-200/50 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer group"
						title="Auto-detect current location"
					>
						{#if detectingLocation}
							<span class="material-symbols-outlined text-[18px] animate-spin text-primary-green">sync</span>
						{:else}
							<span class="material-symbols-outlined text-[18px] text-primary-green group-hover:scale-110 transition-transform">my_location</span>
						{/if}
					</button>
				</div>
				<p class="text-[10px] text-slate-400 font-semibold leading-relaxed">
					Enter a zone or region to instantly monitor its rainfall forecast and schedule watering accordingly.
				</p>
			</div>

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
		</div>

	</div>
</section>
