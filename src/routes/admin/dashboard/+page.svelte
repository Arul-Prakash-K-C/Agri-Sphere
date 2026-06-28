<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade, slide, scale } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	let { data } = $props();

	// Real-time state
	let users = $state([]);
	let products = $state([]);
	let logs = $state([]);
	let loading = $state(true);
	let error = $state('');

	// Unsubscribe functions
	let unsubUsers, unsubProducts, unsubLogs;

	// Chart canvas bindings
	let regCanvas = $state(null);
	let catCanvas = $state(null);
	let growthCanvas = $state(null);

	// Chart instances
	let regChart = null;
	let catChart = null;
	let growthChart = null;

	// Filters and sorting states
	let regFilter = $state('30d'); // 'today', '7d', '30d', '12m'
	let productSort = $state('views'); // 'views', 'contacts', 'date', 'quantity'
	let growthFilter = $state('monthly'); // 'weekly', 'monthly', 'yearly'

	onMount(() => {
		if (!browser) return;

		// Fallback to server data initially
		users = data.users || [];
		logs = data.logs || [];
		loading = true;

		try {
			// Real-time listener for users
			unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
				users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
				loading = false;
			}, (err) => {
				console.error('Error listening to users:', err);
				error = 'Failed to load real-time users data. Using cached view.';
				loading = false;
			});

			// Real-time listener for products
			unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
				products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			}, (err) => {
				console.error('Error listening to products:', err);
			});

			// Real-time listener for system logs
			const logsQuery = query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'));
			unsubLogs = onSnapshot(logsQuery, (snapshot) => {
				logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			}, (err) => {
				console.error('Error listening to system logs:', err);
			});
		} catch (err) {
			console.error('Realtime listener set failure:', err);
			loading = false;
		}
	});

	onDestroy(() => {
		if (unsubUsers) unsubUsers();
		if (unsubProducts) unsubProducts();
		if (unsubLogs) unsubLogs();
		
		if (regChart) regChart.destroy();
		if (catChart) catChart.destroy();
		if (growthChart) growthChart.destroy();
	});

	// --- Derived KPI Stats ---
	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

	let farmers = $derived(users.filter(u => u.role === 'farmer'));
	let buyers = $derived(users.filter(u => u.role === 'customer' || u.role === 'buyer'));
	let verifiedFarmersCount = $derived(farmers.filter(f => f.verified === true).length);
	
	// Products indicators
	let activeListings = $derived(products.filter(p => p.status === 'Available' && Number(p.quantity || 0) > 0));
	let outOfStockListings = $derived(products.filter(p => Number(p.quantity || 0) === 0));
	let soldListings = $derived(products.filter(p => p.status === 'Sold'));

	// Helper to calculate percentage change between current 30 days and previous 30 days
	function getPercentChange(items, dateField = 'createdAt') {
		const currentPeriod = items.filter(item => {
			const d = new Date(item[dateField]);
			return d >= thirtyDaysAgo && d <= now;
		}).length;

		const prevPeriod = items.filter(item => {
			const d = new Date(item[dateField]);
			return d >= sixtyDaysAgo && d < thirtyDaysAgo;
		}).length;

		if (prevPeriod === 0) return currentPeriod > 0 ? '+100%' : '0%';
		const diff = ((currentPeriod - prevPeriod) / prevPeriod) * 100;
		return (diff >= 0 ? '+' : '') + Math.round(diff) + '%';
	}

	// Categories Calculation
	let categoryStats = $derived.by(() => {
		const counts = {};
		products.forEach(p => {
			const cat = p.category || 'Other';
			counts[cat] = (counts[cat] || 0) + 1;
		});
		const list = Object.entries(counts).map(([name, value]) => ({ name, value }));
		list.sort((a, b) => b.value - a.value);
		return {
			list,
			mostPopular: list[0]?.name || 'N/A',
			leastPopular: list[list.length - 1]?.name || 'N/A'
		};
	});

	// Sorting and filtering Product Analytics table list
	let sortedProducts = $derived.by(() => {
		let list = [...products];
		if (productSort === 'views') {
			list.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
		} else if (productSort === 'contacts') {
			list.sort((a, b) => Number(b.contactsCount || 0) - Number(a.contactsCount || 0));
		} else if (productSort === 'date') {
			list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
		} else if (productSort === 'quantity') {
			list.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
		}
		return list.slice(0, 8); // top 8 results
	});

	// Farmers listing metrics
	let topFarmers = $derived.by(() => {
		const listingsMap = {};
		products.forEach(p => {
			if (!p.farmerId) return;
			listingsMap[p.farmerId] = {
				id: p.farmerId,
				name: p.farmerName || p.farmer || 'Farmer',
				count: (listingsMap[p.farmerId]?.count || 0) + 1
			};
		});
		return Object.values(listingsMap).sort((a, b) => b.count - a.count).slice(0, 5);
	});

	// Marketplace details overview
	let productsAddedToday = $derived(products.filter(p => {
		const d = new Date(p.createdAt);
		return d.toDateString() === now.toDateString();
	}).length);

	let productsAddedThisMonth = $derived(products.filter(p => {
		const d = new Date(p.createdAt);
		return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
	}).length);

	let avgProductsPerFarmer = $derived(farmers.length > 0 ? (products.length / farmers.length).toFixed(1) : 0);

	// --- Chart.js Rendering Logic ---
	function updateRegistrationChart() {
		if (!browser || !regCanvas || typeof Chart === 'undefined') return;

		if (regChart) regChart.destroy();

		let labels = [];
		let farmerCounts = [];
		let buyerCounts = [];

		if (regFilter === 'today') {
			labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
			farmerCounts = [0, 0, 0, 0, 0, 0];
			buyerCounts = [0, 0, 0, 0, 0, 0];
			
			// Fill real data
			users.forEach(u => {
				const d = new Date(u.createdAt);
				if (d.toDateString() === now.toDateString()) {
					const hour = d.getHours();
					const slot = Math.min(5, Math.floor(hour / 4));
					if (u.role === 'farmer') farmerCounts[slot]++;
					else buyerCounts[slot]++;
				}
			});
		} else if (regFilter === '7d') {
			for (let i = 6; i >= 0; i--) {
				const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
				
				let fc = 0, bc = 0;
				users.forEach(u => {
					const ud = new Date(u.createdAt);
					if (ud.toDateString() === d.toDateString()) {
						if (u.role === 'farmer') fc++;
						else bc++;
					}
				});
				farmerCounts.push(fc);
				buyerCounts.push(bc);
			}
		} else if (regFilter === '30d') {
			for (let i = 29; i >= 0; i -= 3) {
				const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
				
				let fc = 0, bc = 0;
				users.forEach(u => {
					const ud = new Date(u.createdAt);
					// Match range of 3 days
					const diffDays = Math.floor((now - ud) / (24 * 60 * 60 * 1000));
					if (diffDays >= i - 2 && diffDays <= i) {
						if (u.role === 'farmer') fc++;
						else bc++;
					}
				});
				farmerCounts.push(fc);
				buyerCounts.push(bc);
			}
		} else if (regFilter === '12m') {
			for (let i = 11; i >= 0; i--) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				labels.push(d.toLocaleDateString('en-IN', { month: 'short' }));
				
				let fc = 0, bc = 0;
				users.forEach(u => {
					const ud = new Date(u.createdAt);
					if (ud.getMonth() === d.getMonth() && ud.getFullYear() === d.getFullYear()) {
						if (u.role === 'farmer') fc++;
						else bc++;
					}
				});
				farmerCounts.push(fc);
				buyerCounts.push(bc);
			}
		}

		regChart = new Chart(regCanvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Farmers',
						data: farmerCounts,
						backgroundColor: '#10b981',
						borderRadius: 6
					},
					{
						label: 'Buyers',
						data: buyerCounts,
						backgroundColor: '#3b82f6',
						borderRadius: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { labels: { boxWidth: 12, font: { weight: 'bold', size: 10 } } }
				},
				scales: {
					x: { grid: { display: false } },
					y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } }
				}
			}
		});
	}

	function updateCategoryChart() {
		if (!browser || !catCanvas || typeof Chart === 'undefined') return;

		if (catChart) catChart.destroy();

		const stats = categoryStats.list.slice(0, 5);
		const labels = stats.map(s => s.name);
		const dataValues = stats.map(s => s.value);
		const backgroundColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

		catChart = new Chart(catCanvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{
					data: dataValues,
					backgroundColor: backgroundColors.slice(0, stats.length),
					borderWidth: 2,
					borderColor: '#fff'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: '600' } } }
				},
				cutout: '65%'
			}
		});
	}

	function updateGrowthChart() {
		if (!browser || !growthCanvas || typeof Chart === 'undefined') return;

		if (growthChart) growthChart.destroy();

		let labels = [];
		let prodAdditions = [];

		if (growthFilter === 'weekly') {
			for (let i = 6; i >= 0; i--) {
				const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
				
				let count = 0;
				products.forEach(p => {
					const pd = new Date(p.createdAt);
					if (pd.toDateString() === d.toDateString()) count++;
				});
				prodAdditions.push(count);
			}
		} else if (growthFilter === 'monthly') {
			for (let i = 29; i >= 0; i -= 4) {
				const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
				
				let count = 0;
				products.forEach(p => {
					const pd = new Date(p.createdAt);
					const diffDays = Math.floor((now - pd) / (24 * 60 * 60 * 1000));
					if (diffDays >= i - 3 && diffDays <= i) count++;
				});
				prodAdditions.push(count);
			}
		} else if (growthFilter === 'yearly') {
			for (let i = 11; i >= 0; i--) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				labels.push(d.toLocaleDateString('en-IN', { month: 'short' }));
				
				let count = 0;
				products.forEach(p => {
					const pd = new Date(p.createdAt);
					if (pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()) count++;
				});
				prodAdditions.push(count);
			}
		}

		growthChart = new Chart(growthCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: 'Product Listings Added',
					data: prodAdditions,
					borderColor: '#10b981',
					backgroundColor: 'rgba(16, 185, 129, 0.05)',
					fill: true,
					tension: 0.35,
					borderWidth: 2
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }
				},
				scales: {
					x: { grid: { display: false } },
					y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } }
				}
			}
		});
	}

	$effect(() => {
		const _ = [users, products, regFilter, growthFilter, regCanvas, catCanvas, growthCanvas];
		if (browser) {
			tick().then(() => {
				updateRegistrationChart();
				updateCategoryChart();
				updateGrowthChart();
			});
		}
	});
</script>

<svelte:head>
	<title>Admin Dashboard & Analytics - AgriConnect</title>
</svelte:head>

<section class="mx-auto max-w-[1440px] px-2 py-6 sm:px-6 space-y-6">
	<!-- Top Welcome Title Header -->
	<div class="border-b border-emerald-100 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-250 px-3 py-1 rounded-full">
				Admin Operations Center ⚙️
			</span>
			<h1 class="text-3xl font-black text-slate-900 mt-2 tracking-tight">Platform Control Panel</h1>
			<p class="text-slate-500 text-xs mt-1 font-semibold leading-relaxed">
				Monitor live system logs, farmer availability alerts, pricing charts, and category analysis summaries.
			</p>
		</div>
		{#if error}
			<div class="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2">
				<span class="material-symbols-outlined text-[16px]">warning</span>
				<span>{error}</span>
			</div>
		{/if}
	</div>

	<!-- Loading Skeleton -->
	{#if loading && users.length === 0}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
			{#each Array(4) as _}
				<div class="bg-white border border-slate-200 rounded-2xl p-6 h-36 flex flex-col justify-between">
					<div class="h-6 w-24 bg-slate-100 rounded"></div>
					<div class="h-10 w-16 bg-slate-100 rounded"></div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- 1. KPI Summary Cards Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
			<!-- Total Farmers Card -->
			<div class="glass-card rounded-2xl p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all">
				<div class="flex justify-between items-start">
					<div class="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
						<span class="material-symbols-outlined text-[20px]">agriculture</span>
					</div>
					<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
						{getPercentChange(farmers)} M/M
					</span>
				</div>
				<div>
					<p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Farmers</p>
					<h3 class="text-xl font-extrabold text-slate-800 mt-1">{farmers.length} Users</h3>
				</div>
			</div>

			<!-- Total Buyers Card -->
			<div class="glass-card rounded-2xl p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all">
				<div class="flex justify-between items-start">
					<div class="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
						<span class="material-symbols-outlined text-[20px]">shopping_cart</span>
					</div>
					<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
						{getPercentChange(buyers)} M/M
					</span>
				</div>
				<div>
					<p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Buyers</p>
					<h3 class="text-xl font-extrabold text-slate-800 mt-1">{buyers.length} Users</h3>
				</div>
			</div>

			<!-- Total Products Card -->
			<div class="glass-card rounded-2xl p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all">
				<div class="flex justify-between items-start">
					<div class="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
						<span class="material-symbols-outlined text-[20px]">storefront</span>
					</div>
					<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
						{getPercentChange(products)} M/M
					</span>
				</div>
				<div>
					<p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Products</p>
					<h3 class="text-xl font-extrabold text-slate-800 mt-1">{products.length} Items</h3>
				</div>
			</div>

			<!-- Active Listings Card -->
			<div class="glass-card rounded-2xl p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all">
				<div class="flex justify-between items-start">
					<div class="size-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
						<span class="material-symbols-outlined text-[20px]">check_circle</span>
					</div>
					<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">Live</span>
				</div>
				<div>
					<p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Active Listings</p>
					<h3 class="text-xl font-extrabold text-slate-800 mt-1">{activeListings.length} Live</h3>
				</div>
			</div>

			<!-- Out of Stock Listings Card -->
			<div class="glass-card rounded-2xl p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all">
				<div class="flex justify-between items-start">
					<div class="size-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
						<span class="material-symbols-outlined text-[20px]">block</span>
					</div>
					<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Alert</span>
				</div>
				<div>
					<p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Out of Stock</p>
					<h3 class="text-xl font-extrabold text-slate-850 mt-1">{outOfStockListings.length} Items</h3>
				</div>
			</div>
		</div>

		<!-- 2. Marketplace Overview Cards -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div class="bg-emerald-800 text-white rounded-2xl p-5 flex items-center justify-between shadow">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Added Today</p>
					<h3 class="text-2xl font-black mt-1">{productsAddedToday} Products</h3>
				</div>
				<span class="material-symbols-outlined text-3xl opacity-40">today</span>
			</div>
			<div class="bg-slate-800 text-white rounded-2xl p-5 flex items-center justify-between shadow">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-wider text-slate-350">Added This Month</p>
					<h3 class="text-2xl font-black mt-1">{productsAddedThisMonth} Products</h3>
				</div>
				<span class="material-symbols-outlined text-3xl opacity-40">calendar_month</span>
			</div>
			<div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Products / Farmer</p>
					<h3 class="text-2xl font-black text-slate-800 mt-1">{avgProductsPerFarmer} Items</h3>
				</div>
				<span class="material-symbols-outlined text-3xl text-emerald-600 opacity-20">group</span>
			</div>
			<div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
				<div>
					<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Products Sold</p>
					<h3 class="text-2xl font-black text-slate-850 mt-1">{soldListings.length} Sales</h3>
				</div>
				<span class="material-symbols-outlined text-3xl text-blue-600 opacity-20">shopping_bag</span>
			</div>
		</div>

		<!-- Primary Charts Row -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Registration Analytics Chart -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm lg:col-span-2">
				<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
					<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-emerald-600">group_add</span>
						Registration Analytics
					</h3>
					<div class="flex items-center gap-1">
						{#each [{ key: 'today', label: 'Today' }, { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: '12m', label: '12M' }] as f}
							<button
								onclick={() => { regFilter = f.key; }}
								class={['px-2.5 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer',
									regFilter === f.key ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'].join(' ')}
							>
								{f.label}
							</button>
						{/each}
					</div>
				</div>
				<div class="h-64">
					<canvas bind:this={regCanvas}></canvas>
				</div>
			</div>

			<!-- Category Analytics Donut Chart -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
					<span class="material-symbols-outlined text-[16px] text-emerald-600">pie_chart</span>
					Category Analytics
				</h3>
				<div class="h-48 relative">
					<canvas bind:this={catCanvas}></canvas>
				</div>
				<div class="border-t border-slate-100 pt-3 text-[10px] space-y-1 font-semibold text-slate-500">
					<div class="flex justify-between">
						<span>Most Popular:</span>
						<strong class="text-emerald-700">{categoryStats.mostPopular}</strong>
					</div>
					<div class="flex justify-between">
						<span>Least Popular:</span>
						<strong class="text-slate-650">{categoryStats.leastPopular}</strong>
					</div>
				</div>
			</div>
		</div>

		<!-- Tables Row -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Product Analytics Table -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm lg:col-span-2">
				<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
					<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-emerald-600">inventory</span>
						Product Analytics
					</h3>
					<div class="flex items-center gap-2">
						<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sort by</span>
						<select
							bind:value={productSort}
							class="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="views">Most Viewed</option>
							<option value="contacts">Most Contacted</option>
							<option value="date">Date Added</option>
							<option value="quantity">Stock Quantity</option>
						</select>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[9px] font-bold">
								<th class="py-2">Crop Name</th>
								<th class="py-2">Category</th>
								<th class="py-2">Farmer</th>
								<th class="py-2 text-right">Price</th>
								<th class="py-2 text-right">Stock</th>
								<th class="py-2 text-right">Views</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50 font-semibold text-slate-650">
							{#each sortedProducts as prod (prod.id)}
								<tr class="hover:bg-slate-50/50">
									<td class="py-2.5 font-extrabold text-slate-800">{prod.name}</td>
									<td class="py-2.5 capitalize">{prod.category}</td>
									<td class="py-2.5">{prod.farmerName || 'Farmer'}</td>
									<td class="py-2.5 text-right text-emerald-600">₹{prod.price}/{prod.unit || 'KG'}</td>
									<td class="py-2.5 text-right {Number(prod.quantity || 0) === 0 ? 'text-red-500' : ''}">
										{Number(prod.quantity || 0) === 0 ? 'Out of Stock' : `${prod.quantity} ${prod.unit || 'KG'}`}
									</td>
									<td class="py-2.5 text-right text-slate-400">{prod.views || 0}</td>
								</tr>
							{:else}
								<tr>
									<td colspan="6" class="py-6 text-center text-slate-400">No products listed.</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Farmer Analytics Summary -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
				<div class="space-y-4">
					<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-emerald-600">badge</span>
						Farmer Analytics
					</h3>
					
					<div class="space-y-3">
						<h4 class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Top Listing Farmers</h4>
						<div class="space-y-2">
							{#each topFarmers as farmer}
								<div class="flex justify-between items-center text-xs font-semibold text-slate-700">
									<span class="flex items-center gap-1.5">
										<span class="size-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[9px] uppercase">
											{farmer.name[0]}
										</span>
										{farmer.name}
									</span>
									<span class="bg-slate-50 border border-slate-100 rounded px-2 py-0.5 text-[9px] font-bold text-slate-500">
										{farmer.count} listings
									</span>
								</div>
							{:else}
								<p class="text-xs text-slate-400">No farmer stats available.</p>
							{/each}
						</div>
					</div>
				</div>

				<div class="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3 text-center">
					<div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
						<p class="text-lg font-black text-emerald-600">{verifiedFarmersCount}</p>
						<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Verified</p>
					</div>
					<div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
						<p class="text-lg font-black text-slate-700">{farmers.length - verifiedFarmersCount}</p>
						<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Unverified</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Growth Analytics & Activity Feed Row -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Growth Trends -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm lg:col-span-2">
				<div class="flex justify-between items-center">
					<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-emerald-600">show_chart</span>
						Marketplace Growth Trends
					</h3>
					<div class="flex items-center gap-1">
						{#each [{ key: 'weekly', label: 'W' }, { key: 'monthly', label: 'M' }, { key: 'yearly', label: 'Y' }] as f}
							<button
								onclick={() => { growthFilter = f.key; }}
								class={['px-2.5 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer',
									growthFilter === f.key ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'].join(' ')}
							>
								{f.label}
							</button>
						{/each}
					</div>
				</div>
				<div class="h-60">
					<canvas bind:this={growthCanvas}></canvas>
				</div>
			</div>

			<!-- Activity Feed -->
			<div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
					<span class="material-symbols-outlined text-[16px] text-emerald-600">event_note</span>
					Live Activity Feed
				</h3>
				<div class="flex-grow overflow-y-auto max-h-64 space-y-3 pr-1 divide-y divide-slate-50">
					{#each logs.slice(0, 10) as log (log.id)}
						<div class="pt-2.5 first:pt-0 flex flex-col gap-1 text-xs">
							<div class="flex justify-between items-start gap-2">
								<span class="font-black text-slate-800 truncate leading-tight">{log.title}</span>
								<span class="text-[8px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 mt-0.5">
									{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
								</span>
							</div>
							<p class="text-[10px] leading-relaxed text-slate-500 font-medium font-semibold">
								User: <strong class="text-slate-650">{log.userName || 'System'}</strong> ({log.userEmail || 'system@agriconnect.com'})
							</p>
							<span class="mt-1 w-fit px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border bg-slate-50 text-slate-500 border-slate-100">
								{log.status}
							</span>
						</div>
					{:else}
						<div class="text-center text-slate-400 py-12">
							<span class="material-symbols-outlined text-3xl opacity-30 block">notifications_off</span>
							<p class="text-xs font-semibold mt-1">No system activities logged.</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</section>
