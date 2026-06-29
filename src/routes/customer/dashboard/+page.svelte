<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { showAlert } from '$lib/modal.svelte.js';

	let { data } = $props();

	// Svelte reactive bindings
	let produce = $state([]);
	let orders = $state([]);
	let wishlistIds = $state([]);
	let favoriteFarmerIds = $state([]);

	// --- Availability Alerts State ---
	let subscribedProductIds = $state([]);
	let subscribingProductId = $state(null);
	let unsubscribingProductId = $state(null);

	// --- Price Trend State ---
	let priceHistory = $state([]);
	let priceHistoryLoading = $state(false);
	let priceTrendFilter = $state('all');
	let priceChartCanvas = $state(null);
	let priceChartInstance = null;

	// Sync datasets dynamically
	$effect(() => {
		produce = data.produce || [];
		orders = data.orders || [];
		wishlistIds = data.settings?.wishlist || [];
		favoriteFarmerIds = data.settings?.favoriteFarmers || [];
		// Sync subscriptions
		const subs = data.subscriptions || [];
		subscribedProductIds = subs.map(s => s.productId);
	});

	// Sub-tabs: 'marketplace' | 'wishlist' | 'favorites' | 'compare'
	let activeTab = $state('marketplace');

	// Recently Viewed state persisted in localStorage
	let recentlyViewed = $state([]);
	onMountRecentlyViewed();

	function onMountRecentlyViewed() {
		if (browser) {
			try {
				const saved = localStorage.getItem('cust_recent_viewed');
				if (saved) recentlyViewed = JSON.parse(saved);
			} catch (e) {
				console.error('Error reading recently viewed:', e);
			}
		}
	}

	function addRecentlyViewed(product) {
		if (!product || !browser) return;
		// Filter out duplicate consecutive entries or prior instances
		let updated = recentlyViewed.filter(item => item.id !== product.id);
		updated = [product, ...updated].slice(0, 15); // limit to latest 15
		recentlyViewed = updated;
		try {
			localStorage.setItem('cust_recent_viewed', JSON.stringify(updated));
		} catch (e) {
			console.error('Error saving recently viewed:', e);
		}
	}

	// Product Comparison State
	let compareList = $state([]);

	function toggleComparison(product, event) {
		if (event) event.stopPropagation();
		if (compareList.some(p => p.id === product.id)) {
			compareList = compareList.filter(p => p.id !== product.id);
		} else {
			if (compareList.length >= 3) {
				showAlert({ title: 'Comparison Limit', message: 'You can compare up to 3 products at a time.', type: 'warning' });
				return;
			}
			compareList = [...compareList, product];
		}
	}

	function clearComparison() {
		compareList = [];
	}

	// Derived state to determine the "Best Choice" product during comparison
	// Evaluates: (1) Lowest price (2) Best Quality Grade (3) Maximum available stock
	let bestProductId = $derived.by(() => {
		if (compareList.length < 2) return null;
		
		let best = compareList[0];
		for (let i = 1; i < compareList.length; i++) {
			const current = compareList[i];
			
			// 1. Price comparison (lower is better)
			const priceBest = Number(String(best.price).replace(/[^0-9]/g, ''));
			const priceCurrent = Number(String(current.price).replace(/[^0-9]/g, ''));
			
			if (priceCurrent < priceBest) {
				best = current;
				continue;
			} else if (priceCurrent > priceBest) {
				continue;
			}
			
			// 2. Quality grade comparison (Grade A / Premium / Mixed)
			const gradeWeight = (grade) => {
				const g = String(grade || '').toLowerCase();
				if (g.includes('premium') || g.includes('a')) return 3;
				if (g.includes('mixed')) return 2;
				return 1; // standard / lower
			};
			
			const gradeBest = gradeWeight(best.qualityGrade);
			const gradeCurrent = gradeWeight(current.qualityGrade);
			
			if (gradeCurrent > gradeBest) {
				best = current;
				continue;
			} else if (gradeCurrent < gradeBest) {
				continue;
			}
			
			// 3. Stock volume comparison (higher availability is safer/better)
			const stockBest = Number(best.quantity || 0);
			const stockCurrent = Number(current.quantity || 0);
			if (stockCurrent > stockBest) {
				best = current;
			}
		}
		return best.id;
	});

	// Dynamic wishlist mappings
	let wishlistProducts = $derived(produce.filter(p => wishlistIds.includes(p.id)));

	// Dynamic favorite farmers listings
	let favoriteFarmers = $derived.by(() => {
		const farmersMap = {};
		produce.forEach(p => {
			if (p.farmerId && favoriteFarmerIds.includes(p.farmerId)) {
				if (!farmersMap[p.farmerId]) {
					farmersMap[p.farmerId] = {
						farmerId: p.farmerId,
						farmerName: p.farmerName || p.farmer || 'Verified Farmer',
						location: p.location || p.farmLocation || 'Local Fields',
						phone: p.farmerPhone || '+919876543210',
						email: p.farmerEmail || 'farmer@agriconnect.com',
						activeProductsCount: 0
					};
				}
				farmersMap[p.farmerId].activeProductsCount++;
			}
		});
		return Object.values(farmersMap);
	});

	// Shipping location fallback
	let shippingAddress = $derived(data.profile?.address || 'Mumbai Logistics Hub');

	// Compute Stats
	let activeOrders = $derived(orders.filter(o => o.status !== 'Delivered'));
	let completedOrdersCount = $derived(orders.filter(o => o.status === 'Delivered').length);
	let activeOrdersCount = $derived(activeOrders.length);
	let totalOutlay = $derived(orders.reduce((sum, item) => sum + Number(item.amount || 0), 0));
	
	// Connected Farms count (unique farmers in listed produce or orders)
	let connectedFarmsCount = $derived.by(() => {
		const names = new Set();
		produce.forEach(p => p.farmer && names.add(p.farmer));
		orders.forEach(o => o.farmerName && names.add(o.farmerName));
		return names.size > 0 ? names.size : 8;
	});

	// Format currency helper
	function formatCurrency(val) {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0
		}).format(val);
	}

	// Filter and Search states with localStorage persistence
	let searchQuery = $state(browser ? (localStorage.getItem('cust_search') || '') : '');
	let selectedCategory = $state(browser ? (localStorage.getItem('cust_cat') || 'All') : 'All');
	let filterLocation = $state(browser ? (localStorage.getItem('cust_loc') || '') : '');
	let filterMaxPrice = $state(browser ? (localStorage.getItem('cust_max_price') ? Number(localStorage.getItem('cust_max_price')) : null) : null);
	let sortBy = $state(browser ? (localStorage.getItem('cust_sort') || 'default') : 'default'); // 'default', 'price-low', 'price-high'

	// Persist changes to localStorage
	$effect(() => {
		if (browser) {
			localStorage.setItem('cust_search', searchQuery);
			localStorage.setItem('cust_cat', selectedCategory);
			localStorage.setItem('cust_loc', filterLocation);
			if (filterMaxPrice !== null) {
				localStorage.setItem('cust_max_price', String(filterMaxPrice));
			} else {
				localStorage.removeItem('cust_max_price');
			}
			localStorage.setItem('cust_sort', sortBy);
		}
	});

	// Transient skeleton loading simulation on filter changes
	let isFiltering = $state(false);
	let filterTimeout;
	function triggerFilterLoading() {
		isFiltering = true;
		clearTimeout(filterTimeout);
		filterTimeout = setTimeout(() => {
			isFiltering = false;
		}, 300);
	}

	$effect(() => {
		const _ = [searchQuery, selectedCategory, filterLocation, filterMaxPrice, sortBy];
		triggerFilterLoading();
	});

	let filteredProduce = $derived.by(() => {
		let list = produce.filter(item => {
			const name = item.name || '';
			const farmerName = item.farmer || item.farmerName || '';
			const location = item.location || item.farmLocation || '';
			const category = item.category || '';
			
			// Parse numeric price for filtering
			let priceVal = Number(item.price ? String(item.price).replace(/[^0-9]/g, '') : 0);

			const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			                      farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			                      location.toLowerCase().includes(searchQuery.toLowerCase());
			
			const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
			
			const matchesLocation = !filterLocation || location.toLowerCase().includes(filterLocation.toLowerCase());
			
			const matchesPrice = !filterMaxPrice || priceVal <= filterMaxPrice;
			
			return matchesSearch && matchesCategory && matchesLocation && matchesPrice;
		});

		if (sortBy === 'price-low') {
			list.sort((a, b) => {
				const priceA = Number(a.price ? String(a.price).replace(/[^0-9]/g, '') : 0);
				const priceB = Number(b.price ? String(b.price).replace(/[^0-9]/g, '') : 0);
				return priceA - priceB;
			});
		} else if (sortBy === 'price-high') {
			list.sort((a, b) => {
				const priceA = Number(a.price ? String(a.price).replace(/[^0-9]/g, '') : 0);
				const priceB = Number(b.price ? String(b.price).replace(/[^0-9]/g, '') : 0);
				return priceB - priceA;
			});
		}
		
		return list;
	});

	// Modal states
	let showProductModal = $state(false);
	let selectedProduct = $state(null);
	let currentModalView = $state('details'); // 'details' or 'profile'

	function viewDetails(product, event) {
		if (event) event.stopPropagation();
		selectedProduct = product;
		currentModalView = 'details';
		showProductModal = true;
		// Record item view
		addRecentlyViewed(product);
		// Fetch price history for the product
		fetchPriceHistory(product.id);
	}

	function resetFilters() {
		searchQuery = '';
		selectedCategory = 'All';
		filterLocation = '';
		filterMaxPrice = null;
		sortBy = 'default';
		if (browser) {
			localStorage.removeItem('cust_search');
			localStorage.removeItem('cust_cat');
			localStorage.removeItem('cust_loc');
			localStorage.removeItem('cust_max_price');
			localStorage.removeItem('cust_sort');
		}
	}

	// Toggle Wishlist
	async function toggleWishlist(productId, event) {
		if (event) event.stopPropagation();
		try {
			const res = await fetch('/api/customer/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'toggle_wishlist',
					productId
				})
			});
			if (res.ok) {
				const result = await res.json();
				wishlistIds = result.wishlist;
			}
		} catch (err) {
			console.error('Error toggling wishlist:', err);
		}
	}

	// Toggle Favorite Farmer
	async function toggleFavoriteFarmer(farmerId, event) {
		if (event) event.stopPropagation();
		try {
			const res = await fetch('/api/customer/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'toggle_favorite_farmer',
					farmerId
				})
			});
			if (res.ok) {
				const result = await res.json();
				favoriteFarmerIds = result.favoriteFarmers;
			}
		} catch (err) {
			console.error('Error toggling favorite farmer:', err);
		}
	}

	// Quick navigation helper to show farmer listings
	function viewFarmerListings(farmerName) {
		searchQuery = farmerName;
		activeTab = 'marketplace';
	}

	// --- Availability Alert Functions ---
	async function subscribeAvailability(productId) {
		subscribingProductId = productId;
		try {
			const res = await fetch('/api/availability-subscriptions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId })
			});
			if (res.ok || res.status === 409) {
				subscribedProductIds = [...subscribedProductIds, productId];
			}
		} catch (err) {
			console.error('Error subscribing to availability:', err);
		} finally {
			subscribingProductId = null;
		}
	}

	async function unsubscribeAvailability(productId) {
		unsubscribingProductId = productId;
		try {
			const res = await fetch(`/api/availability-subscriptions?productId=${productId}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				subscribedProductIds = subscribedProductIds.filter(id => id !== productId);
			}
		} catch (err) {
			console.error('Error unsubscribing from availability:', err);
		} finally {
			unsubscribingProductId = null;
		}
	}

	function isOutOfStock(product) {
		const qty = Number(product.quantity || 0);
		return qty === 0;
	}

	// --- Price Trend Functions ---
	async function fetchPriceHistory(productId) {
		priceHistoryLoading = true;
		priceHistory = [];
		priceTrendFilter = 'all';
		try {
			const res = await fetch(`/api/price-history?productId=${productId}`);
			if (res.ok) {
				priceHistory = await res.json();
			}
		} catch (err) {
			console.error('Error fetching price history:', err);
		} finally {
			priceHistoryLoading = false;
		}
	}

	let filteredPriceHistory = $derived.by(() => {
		if (priceTrendFilter === 'all' || priceHistory.length === 0) return priceHistory;
		const now = Date.now();
		const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
		const days = daysMap[priceTrendFilter] || 9999;
		const cutoff = now - days * 24 * 60 * 60 * 1000;
		return priceHistory.filter(p => new Date(p.updatedAt).getTime() >= cutoff);
	});

	let priceStats = $derived.by(() => {
		const hist = filteredPriceHistory;
		if (hist.length === 0) return null;

		const parsePrice = (p) => Number(String(p).replace(/[^0-9.]/g, '')) || 0;
		const prices = hist.map(h => parsePrice(h.price));

		const current = prices[prices.length - 1];
		const highest = Math.max(...prices);
		const lowest = Math.min(...prices);
		const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
		const first = prices[0];
		const changePercent = first > 0 ? ((current - first) / first * 100) : 0;
		const lastUpdated = hist[hist.length - 1]?.updatedAt;

		return {
			current,
			highest,
			lowest,
			average: Math.round(average * 100) / 100,
			changePercent: Math.round(changePercent * 100) / 100,
			lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'
		};
	});

	function renderPriceChart() {
		if (!browser || !priceChartCanvas || typeof Chart === 'undefined') return;

		if (priceChartInstance) {
			priceChartInstance.destroy();
			priceChartInstance = null;
		}

		const hist = filteredPriceHistory;
		if (hist.length < 2) return;

		const parsePrice = (p) => Number(String(p).replace(/[^0-9.]/g, '')) || 0;
		const labels = hist.map(h => new Date(h.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
		const dataPoints = hist.map(h => parsePrice(h.price));

		priceChartInstance = new Chart(priceChartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: 'Price (₹)',
					data: dataPoints,
					borderColor: '#16a34a',
					backgroundColor: 'rgba(22, 163, 74, 0.08)',
					fill: true,
					tension: 0.35,
					pointRadius: 4,
					pointBackgroundColor: '#16a34a',
					pointBorderColor: '#fff',
					pointBorderWidth: 2,
					borderWidth: 2.5
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: '#1e293b',
						titleFont: { size: 11, weight: 'bold' },
						bodyFont: { size: 11 },
						cornerRadius: 8,
						padding: 10,
						callbacks: {
							label: (ctx) => `₹${ctx.parsed.y.toLocaleString('en-IN')}`
						}
					}
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: { font: { size: 10, weight: '600' }, color: '#94a3b8' }
					},
					y: {
						grid: { color: 'rgba(0,0,0,0.04)' },
						ticks: {
							font: { size: 10, weight: '600' },
							color: '#94a3b8',
							callback: (val) => '₹' + val.toLocaleString('en-IN')
						}
					}
				}
			}
		});
	}

	// Re-render chart when filtered data or canvas changes
	$effect(() => {
		const _ = [filteredPriceHistory, priceChartCanvas];
		if (browser && priceChartCanvas && filteredPriceHistory.length >= 2) {
			// Use tick to ensure DOM is updated before rendering
			tick().then(() => renderPriceChart());
		}
	});
</script>

<svelte:head>
	<title>Customer Dashboard - AgriConnect</title>
</svelte:head>

<!-- Main Container -->
<section class="max-w-[1440px] mx-auto space-y-6 text-slate-800 bg-[#F8FAF5] min-h-[85vh] p-1 rounded-3xl">
	
	<!-- Top Welcome & Tabs -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2 border-b border-emerald-100 pb-5">
		<div>
			<h1 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">🌾</span> Produce Marketplace
			</h1>
			<p class="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
				Direct connection between verified farmers and local buyers. Arrange deliveries, quantities, and pricing negotiations directly.
			</p>
		</div>
		<div>
			<span class="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-2xl max-w-xs truncate inline-block">
				📍 Shipping to: <strong class="text-dark-green">{shippingAddress}</strong>
			</span>
		</div>
	</div>

	<!-- Secondary Module Navigation Bar -->
	<div class="bg-white border border-emerald-100 rounded-2xl p-2.5 shadow-sm flex items-center justify-between overflow-x-auto whitespace-nowrap gap-4">
		<div class="flex items-center gap-2">
			<button 
				onclick={() => activeTab = 'marketplace'} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'marketplace' ? 'bg-primary-green text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px]">storefront</span>
				<span>Browse Marketplace</span>
			</button>
			<button 
				onclick={() => activeTab = 'wishlist'} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'wishlist' ? 'bg-primary-green text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px] text-red-500 filled">favorite</span>
				<span>My Wishlist ({wishlistIds.length})</span>
			</button>
			<button 
				onclick={() => activeTab = 'favorites'} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'favorites' ? 'bg-primary-green text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px] text-amber-500 filled">star</span>
				<span>Favorite Farmers ({favoriteFarmerIds.length})</span>
			</button>
			<button 
				onclick={() => activeTab = 'compare'} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'compare' ? 'bg-primary-green text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px]">compare_arrows</span>
				<span>Compare Products ({compareList.length}/3)</span>
			</button>
		</div>
		{#if compareList.length > 0}
			<div class="flex items-center gap-2">
				<button 
					onclick={clearComparison}
					class="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
				>
					<span class="material-symbols-outlined text-[15px]">delete</span> Clear Compare
				</button>
			</div>
		{/if}
	</div>

	<!-- Module Tab Views -->
	{#if activeTab === 'marketplace'}
		<!-- Stats Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36 bg-white border border-emerald-100/50">
				<div class="flex justify-between items-start">
					<div class="size-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-primary-green">
						<span class="material-symbols-outlined text-[22px]">local_shipping</span>
					</div>
					<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold">
						Deliveries
					</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Orders</p>
					<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{completedOrdersCount} Deliveries</h3>
				</div>
			</div>

			<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36 bg-white border border-emerald-100/50">
				<div class="flex justify-between items-start">
					<div class="size-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
						<span class="material-symbols-outlined text-[22px]">assignment</span>
					</div>
					<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold">
						In Transit
					</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Purchases</p>
					<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{activeOrdersCount} Contracts</h3>
				</div>
			</div>

			<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36 bg-white border border-emerald-100/50">
				<div class="flex justify-between items-start">
					<div class="size-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-primary-green">
						<span class="material-symbols-outlined text-[22px]">payments</span>
					</div>
					<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold">
						Secure escrow
					</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Outlays (Total)</p>
					<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{formatCurrency(totalOutlay)}</h3>
				</div>
			</div>

			<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36 bg-white border border-emerald-100/50">
				<div class="flex justify-between items-start">
					<div class="size-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
						<span class="material-symbols-outlined text-[22px]">agriculture</span>
					</div>
					<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold">
						Verified
					</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected Farms</p>
					<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{connectedFarmsCount} Partners</h3>
				</div>
			</div>
		</div>

		<!-- Search & Filters Toolbar -->
		<div class="bg-white border border-emerald-100/60 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
			<div class="grid gap-4 md:grid-cols-12 items-center">
				<div class="relative md:col-span-4 w-full">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
					<input 
						type="text" 
						bind:value={searchQuery}
						placeholder="Search crops, farms, location..." 
						class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold focus:ring-1 focus:ring-primary-green focus:bg-white transition-all outline-none"
					/>
				</div>

				<div class="relative md:col-span-3 w-full">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">pin_drop</span>
					<input 
						type="text" 
						bind:value={filterLocation}
						placeholder="Filter by farm location..." 
						class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold focus:ring-1 focus:ring-primary-green focus:bg-white transition-all outline-none"
					/>
				</div>

				<div class="relative md:col-span-3 w-full flex items-center gap-2">
					<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Max Price (₹)</span>
					<input 
						type="number" 
						bind:value={filterMaxPrice}
						placeholder="Any" 
						min="0"
						step="1"
						class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 px-3.5 text-xs font-semibold focus:ring-1 focus:ring-primary-green focus:bg-white transition-all outline-none"
					/>
				</div>

				<div class="md:col-span-2 flex items-center gap-2">
					<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Sort</span>
					<select 
						bind:value={sortBy} 
						class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-600 focus:ring-1 focus:ring-primary-green outline-none"
					>
						<option value="default">Default</option>
						<option value="price-low">Price: Low to High</option>
						<option value="price-high">Price: High to Low</option>
					</select>
				</div>
			</div>

			<!-- Category Chips Selection -->
			<div class="flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-slate-100 pt-3">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">Categories:</span>
				{#each ['All', 'Vegetables', 'Fruits', 'Grains', 'Legumes', 'Dairy'] as cat}
					<button
						type="button"
						onclick={() => { selectedCategory = cat; }}
						class={[
							'px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer',
							selectedCategory === cat
								? 'bg-primary-green text-white border-primary-green shadow-sm'
								: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
						].filter(Boolean).join(' ')}
					>
						{cat}
					</button>
				{/each}
			</div>
		</div>

		<!-- Recently Viewed Products Carousel section -->
		{#if recentlyViewed.length > 0}
			<div class="bg-white border border-emerald-100/50 rounded-2xl p-5 space-y-3 animate-fade-in shadow-sm">
				<h3 class="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
					<span class="material-symbols-outlined text-[16px] text-primary-green">history</span>
					Recently Viewed Products
				</h3>
				<div class="flex gap-4 overflow-x-auto pb-1.5 no-scrollbar">
					{#each recentlyViewed as recentItem (recentItem.id)}
						<button 
							onclick={(e) => viewDetails(recentItem, e)}
							class="flex items-center gap-3 p-2 bg-[#F8FAF5]/40 border border-emerald-100 hover:bg-[#F8FAF5] rounded-xl text-left transition-all cursor-pointer group min-w-[220px] max-w-[240px] shrink-0"
						>
							<img src={recentItem.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={recentItem.name} class="size-12 rounded-lg object-cover" />
							<div class="flex-grow min-w-0">
								<p class="font-bold text-slate-800 text-xs truncate group-hover:text-primary-green transition-colors">{recentItem.name}</p>
								<p class="text-[10px] text-slate-400 mt-0.5 font-medium">₹{recentItem.price || '0'}/{recentItem.unit || 'KG'}</p>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Marketplace Produce Available Grid -->
		<div class="space-y-4">
			<div class="flex justify-between items-center mb-1">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Verified Produce Available</h3>
				<span class="text-xs font-semibold text-slate-400">{filteredProduce.length} listings found</span>
			</div>

			<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
				{#each filteredProduce as crop (crop.id)}
					{@const isWishlisted = wishlistIds.includes(crop.id)}
					{@const isCompared = compareList.some(p => p.id === crop.id)}
					<div 
						role="button"
						tabindex="0"
						onclick={(e) => viewDetails(crop, e)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && viewDetails(crop, e)}
						class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer relative"
					>
						<!-- Save to wishlist and Compare action overlays -->
						<div class="absolute top-3 right-3 flex gap-2 z-10">
							<button 
								onclick={(e) => toggleComparison(crop, e)}
								class={['size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm', 
									isCompared ? 'bg-primary-green text-white border-primary-green' : 'bg-white/80 border-slate-200 text-slate-500 hover:text-primary-green'].join(' ')}
								title="Compare product"
							>
								<span class="material-symbols-outlined text-[16px]">compare_arrows</span>
							</button>
							<button 
								onclick={(e) => toggleWishlist(crop, e)}
								class={['size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm', 
									isWishlisted ? 'bg-white text-red-500 border-slate-200' : 'bg-white/80 border-slate-200 text-slate-500 hover:text-red-500'].join(' ')}
								title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
							>
								<span class="material-symbols-outlined text-[16px] {isWishlisted ? 'filled' : ''}">favorite</span>
							</button>
						</div>

						<div class="h-40 w-full relative overflow-hidden flex-shrink-0">
							<img src={crop.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={crop.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
							<div class="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
							<div class="absolute bottom-2.5 left-3 text-white pr-10">
								<h4 class="font-extrabold text-sm leading-tight truncate">{crop.name}</h4>
								<p class="text-[9px] text-white/85 font-bold flex items-center gap-0.5 mt-0.5">
									{crop.farmer || 'Verified Farmer'}
									<span class="material-symbols-outlined text-[11px] text-emerald-400 filled">verified</span>
								</p>
							</div>
							{#if isOutOfStock(crop)}
								<div class="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
									<span class="material-symbols-outlined text-[12px]">block</span>
									Out of Stock
								</div>
							{/if}
						</div>

						<div class="p-3.5 flex-grow flex flex-col justify-between gap-3.5">
							<div class="flex justify-between items-center text-[10px]">
								<span class="bg-emerald-50 text-dark-green border border-emerald-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
									{crop.category || 'Produce'}
								</span>
								<span class="text-slate-400 font-bold flex items-center gap-0.5 truncate max-w-[100px]">
									<span class="material-symbols-outlined text-[12px]">pin_drop</span>
									{crop.location || 'Local Fields'}
								</span>
							</div>

							<div class="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50 text-[10px] font-semibold text-slate-500">
								<div class="flex justify-between">
									<span>Available Stock</span>
									<strong class={isOutOfStock(crop) ? 'text-red-500' : 'text-slate-700'}>{isOutOfStock(crop) ? 'Out of Stock' : `${crop.quantity || '30'} ${crop.unit || 'KG'}`}</strong>
								</div>
								<div class="flex justify-between">
									<span>Harvest Date</span>
									<strong class="text-slate-700">{crop.harvestDate || 'Recently'}</strong>
								</div>
							</div>

							<div class="border-t border-slate-50 pt-2 flex justify-between items-center">
								<div>
									<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Direct Price</p>
									<p class="text-sm font-black text-primary-green mt-0.5">
										₹{crop.price} 
										<span class="text-[9px] text-slate-400 font-normal">/ {crop.unit || 'KG'}</span>
									</p>
								</div>
								{#if isOutOfStock(crop)}
									{@const isSubscribed = subscribedProductIds.includes(crop.id)}
									<button
										onclick={(e) => { e.stopPropagation(); isSubscribed ? unsubscribeAvailability(crop.id) : subscribeAvailability(crop.id); }}
										disabled={subscribingProductId === crop.id || unsubscribingProductId === crop.id}
										class={['text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer disabled:opacity-60',
											isSubscribed ? 'bg-emerald-50 text-dark-green border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'].join(' ')}
									>
										<span class="material-symbols-outlined text-[13px]">{isSubscribed ? 'notifications_active' : 'notification_add'}</span>
										{isSubscribed ? 'Subscribed' : 'Notify Me'}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="col-span-full bg-white p-12 rounded-2xl text-center text-slate-400 border border-slate-200/50">
						<span class="material-symbols-outlined text-4xl text-slate-350 block mb-2">storefront</span>
						<p class="font-bold text-slate-500">No active products match your criteria.</p>
					</div>
				{/each}
			</div>
		</div>

	{:else if activeTab === 'wishlist'}
		<!-- Dedicated Wishlist Tab View -->
		<div class="space-y-4 animate-fade-in">
			<div>
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Saved Wishlist Products</h3>
				<p class="text-xs text-slate-400 font-semibold mt-0.5">View and monitor listed produce items you have bookmarked.</p>
			</div>

			<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
				{#each wishlistProducts as crop (crop.id)}
					{@const isWishlisted = true}
					{@const isCompared = compareList.some(p => p.id === crop.id)}
					<div 
						role="button"
						tabindex="0"
						onclick={(e) => viewDetails(crop, e)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && viewDetails(crop, e)}
						class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer relative animate-fade-in"
					>
						<div class="absolute top-3 right-3 flex gap-2 z-10">
							<button 
								onclick={(e) => toggleComparison(crop, e)}
								class={['size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm', 
									isCompared ? 'bg-primary-green text-white border-primary-green' : 'bg-white/80 border-slate-200 text-slate-500 hover:text-primary-green'].join(' ')}
								title="Compare product"
							>
								<span class="material-symbols-outlined text-[16px]">compare_arrows</span>
							</button>
							<button 
								onclick={(e) => toggleWishlist(crop, e)}
								class="size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm bg-white text-red-500 border-slate-200"
								title="Remove from Wishlist"
							>
								<span class="material-symbols-outlined text-[16px] filled">favorite</span>
							</button>
						</div>

						<div class="h-40 w-full relative overflow-hidden flex-shrink-0">
							<img src={crop.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={crop.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
							<div class="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
							<div class="absolute bottom-2.5 left-3 text-white pr-10">
								<h4 class="font-extrabold text-sm leading-tight truncate">{crop.name}</h4>
								<p class="text-[9px] text-white/85 font-bold flex items-center gap-0.5 mt-0.5">
									{crop.farmer || 'Verified Farmer'}
									<span class="material-symbols-outlined text-[11px] text-emerald-400 filled">verified</span>
								</p>
							</div>
						</div>

						<div class="p-3.5 flex-grow flex flex-col justify-between gap-3.5">
							<div class="flex justify-between items-center text-[10px]">
								<span class="bg-emerald-50 text-dark-green border border-emerald-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
									{crop.category || 'Produce'}
								</span>
								<span class="text-slate-400 font-bold flex items-center gap-0.5 truncate max-w-[100px]">
									<span class="material-symbols-outlined text-[12px]">pin_drop</span>
									{crop.location || 'Local Fields'}
								</span>
							</div>

							<div class="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50 text-[10px] font-semibold text-slate-500">
								<div class="flex justify-between">
									<span>Available Stock</span>
									<strong class="text-slate-700">{crop.quantity || '30'} {crop.unit || 'KG'}</strong>
								</div>
								<div class="flex justify-between">
									<span>Harvest Date</span>
									<strong class="text-slate-700">{crop.harvestDate || 'Recently'}</strong>
								</div>
							</div>

							<div class="border-t border-slate-50 pt-2 flex justify-between items-center">
								<div>
									<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Direct Price</p>
									<p class="text-sm font-black text-primary-green mt-0.5">
										₹{crop.price} 
										<span class="text-[9px] text-slate-400 font-normal">/ {crop.unit || 'KG'}</span>
									</p>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="col-span-full bg-white p-16 rounded-2xl text-center text-slate-400 border border-slate-200/50">
						<span class="material-symbols-outlined text-4xl text-slate-300 block mb-2">favorite_border</span>
						<p class="font-bold text-slate-500">Your wishlist is empty.</p>
						<button onclick={() => activeTab = 'marketplace'} class="mt-3 btn-primary text-xs px-4 py-2 cursor-pointer">Browse Produce</button>
					</div>
				{/each}
			</div>
		</div>

	{:else if activeTab === 'favorites'}
		<!-- Dedicated Favorite Farmers followed view -->
		<div class="space-y-4 animate-fade-in">
			<div>
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">My Followed Farmers</h3>
				<p class="text-xs text-slate-400 font-semibold mt-0.5">Quickly access product listings and origins of your favorite farm partners.</p>
			</div>

			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each favoriteFarmers as farmer (farmer.farmerId)}
					<div class="bg-white border border-slate-200/60 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow relative">
						<!-- Unfollow overlay -->
						<button 
							onclick={(e) => toggleFavoriteFarmer(farmer.farmerId, e)}
							class="absolute top-4 right-4 size-7 rounded-xl bg-slate-50 border border-slate-100 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center text-slate-450 cursor-pointer"
							title="Unfollow Farmer"
						>
							<span class="material-symbols-outlined text-[15px]">close</span>
						</button>

						<div class="flex items-center gap-3.5">
							<div class="size-12 rounded-full bg-gradient-to-tr from-primary-green to-dark-green text-white flex items-center justify-center font-black text-base uppercase shadow-sm">
								{farmer.farmerName[0]}
							</div>
							<div>
								<h4 class="font-bold text-slate-800 text-sm flex items-center gap-1">
									{farmer.farmerName}
									<span class="material-symbols-outlined text-[15px] text-emerald-500 filled">verified</span>
								</h4>
								<p class="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-0.5">
									<span class="material-symbols-outlined text-[13px]">pin_drop</span> {farmer.location}
								</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 bg-[#F8FAF5]/60 border border-emerald-100/40 p-3 rounded-xl">
							<div>
								<span class="text-slate-400 block">Listed Crops</span>
								<strong class="text-slate-800 text-xs">{farmer.activeProductsCount} Items</strong>
							</div>
							<div>
								<span class="text-slate-400 block">Phone Contact</span>
								<a href="tel:{farmer.phone}" class="text-primary-green hover:underline block truncate mt-0.5">{farmer.phone}</a>
							</div>
						</div>

						<div class="flex gap-2">
							<button 
								onclick={() => viewFarmerListings(farmer.farmerName)}
								class="btn-primary py-2 text-xs flex-1 cursor-pointer flex items-center justify-center gap-1.5"
							>
								<span class="material-symbols-outlined text-[16px]">grid_view</span> View Listings
							</button>
						</div>
					</div>
				{:else}
					<div class="col-span-full bg-white p-16 rounded-2xl text-center text-slate-400 border border-slate-200/50">
						<span class="material-symbols-outlined text-4xl text-slate-350 block mb-2">stars</span>
						<p class="font-bold text-slate-500">You haven't followed any farmers yet.</p>
						<p class="text-xs text-slate-400 mt-1">Open product specifications in the marketplace to follow verified growers.</p>
					</div>
				{/each}
			</div>
		</div>

	{:else if activeTab === 'compare'}
		<!-- Product Comparison Grid table layout -->
		<div class="space-y-4 animate-fade-in">
			<div>
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Product Comparison</h3>
				<p class="text-xs text-slate-400 font-semibold mt-0.5">Select up to 3 produce items in the marketplace to compare side-by-side specs.</p>
			</div>

			{#if compareList.length > 0}
				<div class="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr class="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
									<th class="p-4 pl-6 w-48">Spec/Feature</th>
									{#each compareList as p}
										<th class="p-4 relative">
											{#if bestProductId === p.id}
												<div class="absolute -top-1 left-4 bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-b-md shadow-sm tracking-widest animate-pulse z-20">
													⭐ Best Choice
												</div>
											{/if}
											<button 
												onclick={(e) => toggleComparison(p, e)}
												class="absolute top-2 right-2 text-slate-400 hover:text-red-500 size-6 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer"
												title="Remove item"
											>
												<span class="material-symbols-outlined text-[14px]">close</span>
											</button>
											<div class="flex items-center gap-3 mt-2 pr-6">
												<img src={p.imageUrl} alt={p.name} class="size-12 rounded-lg object-cover" />
												<div>
													<p class="font-black text-slate-800 truncate text-xs">{p.name}</p>
													<p class="text-[9px] text-slate-400 font-bold mt-0.5">{p.category}</p>
												</div>
											</div>
										</th>
									{/each}
									<!-- Placeholders if less than 3 -->
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<th class="p-4 text-slate-350 italic font-medium text-[10px]">Empty Slot</th>
									{/each}
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-50 text-slate-650 font-medium">
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Farmer</td>
									{#each compareList as p}
										<td class="p-4 text-slate-800 font-bold">{p.farmerName || p.farmer || 'Verified Farmer'}</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Price</td>
									{#each compareList as p}
										<td class="p-4 text-primary-green font-black text-sm">₹{p.price} <span class="text-[10px] text-slate-400 font-normal">/ {p.unit || 'KG'}</span></td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Available Quantity</td>
									{#each compareList as p}
										<td class="p-4 text-slate-800 font-bold">{p.quantity} {p.unit || 'KG'}</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Unit</td>
									{#each compareList as p}
										<td class="p-4 text-slate-600">{p.unit || 'KG'}</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Quality Grade</td>
									{#each compareList as p}
										<td class="p-4">
											<span class="bg-[#F8FAF5] border border-emerald-100 text-dark-green text-[10px] font-bold px-2 py-0.5 rounded">
												{p.qualityGrade || 'Grade A'}
											</span>
										</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Harvest Date</td>
									{#each compareList as p}
										<td class="p-4 text-slate-500 font-semibold">{p.harvestDate || 'Recently Harvested'}</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
								<tr class="hover:bg-slate-50/20">
									<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Availability</td>
									{#each compareList as p}
										<td class="p-4">
											<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-dark-green border-emerald-100">
												{p.status || 'Available'}
											</span>
										</td>
									{/each}
									{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
										<td class="p-4 text-slate-300">—</td>
									{/each}
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<div class="bg-white p-16 rounded-2xl text-center text-slate-400 border border-slate-200/50">
					<span class="material-symbols-outlined text-4xl text-slate-350 block mb-2">compare_arrows</span>
					<p class="font-bold text-slate-500">Comparison list is empty.</p>
					<p class="text-xs text-slate-400 mt-1">Select items in the browse produce grid to add them to comparison view.</p>
					<button onclick={() => activeTab = 'marketplace'} class="mt-3 btn-primary text-xs px-4 py-2 cursor-pointer">Go to Browse</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- View Details Modal (Extended with Favorite Farmer toggle) -->
	<Modal bind:show={showProductModal} size="xl" title="Product Specification" type="custom">
		{#if selectedProduct}
			{@const isFarmerFavorited = favoriteFarmerIds.includes(selectedProduct.farmerId)}
			<div class="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
					
					<!-- View 1: Details -->
					{#if currentModalView === 'details'}
						<div class="grid gap-6 md:grid-cols-[2fr_3fr] border-b border-slate-100 pb-5">
							<div class="relative h-56 rounded-2xl overflow-hidden border border-slate-100">
								<img src={selectedProduct.imageUrl} alt={selectedProduct.name} class="w-full h-full object-cover" />
								<div class="absolute bottom-2.5 left-3 bg-slate-950/60 text-white text-[10px] font-bold px-2 py-0.5 rounded">
									₹{selectedProduct.price} / {selectedProduct.unit || 'KG'}
								</div>
							</div>
							
							<div class="space-y-3 text-xs font-semibold text-slate-700">
								<div>
									<span class="text-slate-400 block text-[9px] uppercase">Category</span>
									<span class="text-slate-800 font-black text-sm capitalize">{selectedProduct.category}</span>
								</div>
								
								<div>
									<span class="text-slate-400 block text-[9px] uppercase">Product Name</span>
									<span class="text-slate-900 font-extrabold text-lg">{selectedProduct.name}</span>
								</div>

								<div class="grid grid-cols-2 gap-3 pt-2">
									<div>
										<span class="text-slate-400 block text-[9px] uppercase">Total Size</span>
										<span class="text-slate-800 font-black">{selectedProduct.quantity} {selectedProduct.unit || 'KG'}</span>
									</div>
									<div>
										<span class="text-slate-400 block text-[9px] uppercase">Harvest Date</span>
										<span class="text-slate-800 font-black">{selectedProduct.harvestDate || 'Recently Harvested'}</span>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<div>
										<span class="text-slate-400 block text-[9px] uppercase">Quality Grade</span>
										<span class="text-slate-800 font-black">{selectedProduct.qualityGrade || 'Grade A'}</span>
									</div>
									<div>
										<span class="text-slate-400 block text-[9px] uppercase">Farm Origin</span>
										<span class="text-slate-800 font-black">{selectedProduct.location || 'Local Fields'}</span>
									</div>
								</div>
							</div>
						</div>

						<div class="space-y-2 border-b border-slate-100 pb-4">
							<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Crops Description</h4>
							<p class="text-slate-650 leading-relaxed font-medium font-normal text-xs">{selectedProduct.description || 'No additional description provided.'}</p>
						</div>

						<!-- Availability Alert inside Details -->
						{#if isOutOfStock(selectedProduct)}
							{@const isSubbed = subscribedProductIds.includes(selectedProduct.id)}
							<div class="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div class="flex items-center gap-3">
									<div class="size-10 rounded-xl bg-red-100 flex items-center justify-center">
										<span class="material-symbols-outlined text-red-600 text-[20px]">inventory</span>
									</div>
									<div>
										<p class="text-xs font-bold text-red-700">Currently Out of Stock</p>
										<p class="text-[10px] text-red-500 mt-0.5 font-medium">{isSubbed ? 'We\'ll notify you when it\'s back.' : 'Get notified when this product is restocked.'}</p>
									</div>
								</div>
								<button
									onclick={() => isSubbed ? unsubscribeAvailability(selectedProduct.id) : subscribeAvailability(selectedProduct.id)}
									disabled={subscribingProductId === selectedProduct.id || unsubscribingProductId === selectedProduct.id}
									class={['text-xs font-bold px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm',
										isSubbed ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'].join(' ')}
								>
									{#if subscribingProductId === selectedProduct.id || unsubscribingProductId === selectedProduct.id}
										<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
										Processing…
									{:else}
										<span class="material-symbols-outlined text-[15px]">{isSubbed ? 'notifications_active' : 'notification_add'}</span>
										{isSubbed ? 'Subscribed ✓' : 'Notify Me'}
									{/if}
								</button>
							</div>
						{/if}

						<!-- Price Trend Section -->
						<div class="space-y-3 border-b border-slate-100 pb-5">
							<div class="flex items-center justify-between">
								<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[14px] text-primary-green">trending_up</span>
									Price Trend
								</h4>
								<div class="flex items-center gap-1">
									{#each [{ key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: '90d', label: '90D' }, { key: 'all', label: 'All' }] as f}
										<button
											onclick={() => { priceTrendFilter = f.key; }}
											class={['px-2.5 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer',
												priceTrendFilter === f.key ? 'bg-primary-green text-white border-primary-green shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'].join(' ')}
										>
											{f.label}
										</button>
									{/each}
								</div>
							</div>

							{#if priceHistoryLoading}
								<div class="flex items-center justify-center py-8">
									<span class="material-symbols-outlined text-2xl text-primary-green animate-spin">progress_activity</span>
								</div>
							{:else if priceStats && filteredPriceHistory.length >= 2}
								<!-- Stats Cards -->
								<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
									<div class="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Current</p>
										<p class="text-sm font-black text-primary-green mt-0.5">₹{priceStats.current.toLocaleString('en-IN')}</p>
									</div>
									<div class="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Highest</p>
										<p class="text-sm font-black text-red-500 mt-0.5">₹{priceStats.highest.toLocaleString('en-IN')}</p>
									</div>
									<div class="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Lowest</p>
										<p class="text-sm font-black text-emerald-600 mt-0.5">₹{priceStats.lowest.toLocaleString('en-IN')}</p>
									</div>
									<div class="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Average</p>
										<p class="text-sm font-black text-slate-700 mt-0.5">₹{priceStats.average.toLocaleString('en-IN')}</p>
									</div>
									<div class="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Change</p>
										<p class={['text-sm font-black mt-0.5 flex items-center justify-center gap-0.5',
											priceStats.changePercent >= 0 ? 'text-red-500' : 'text-emerald-600'].join(' ')}>
											<span class="material-symbols-outlined text-[14px]">{priceStats.changePercent >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
											{Math.abs(priceStats.changePercent)}%
										</p>
									</div>
								</div>

								<p class="text-[9px] text-slate-400 font-semibold">Last Updated: {priceStats.lastUpdated}</p>

								<!-- Chart -->
								<div class="bg-white border border-slate-100 rounded-xl p-3" style="height: 200px;">
									<canvas bind:this={priceChartCanvas}></canvas>
								</div>
							{:else}
								<div class="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
									<span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">show_chart</span>
									<p class="text-xs font-bold text-slate-400">Not enough price history available.</p>
									<p class="text-[10px] text-slate-350 mt-0.5">Price trend data will appear after multiple price updates.</p>
								</div>
							{/if}
						</div>

						<!-- Farmer Card inside Details -->
						<div class="bg-[#F8FAF5] border border-emerald-100/50 rounded-2xl p-5 mt-4 space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Farmer Information</h4>
								<div class="flex items-center gap-3">
									{#if selectedProduct.farmerId}
										<button 
											onclick={(e) => toggleFavoriteFarmer(selectedProduct.farmerId, e)}
											class={['text-xs font-bold transition-all px-3 py-1 rounded-full border cursor-pointer flex items-center gap-1 shadow-sm', 
												isFarmerFavorited ? 'bg-amber-500 text-white border-amber-500' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'].join(' ')}
										>
											<span class="material-symbols-outlined text-[13px] {isFarmerFavorited ? 'filled' : ''}">star</span>
											<span>{isFarmerFavorited ? 'Followed' : 'Follow Farmer'}</span>
										</button>
									{/if}
									<button 
										onclick={() => { currentModalView = 'profile'; }}
										class="text-xs font-bold text-primary-green hover:text-dark-green hover:underline flex items-center gap-0.5 cursor-pointer"
									>
										View Full Farm Profile →
									</button>
								</div>
							</div>

							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div class="flex items-center gap-3">
									<div class="size-12 rounded-full bg-gradient-to-tr from-primary-green to-dark-green text-white flex items-center justify-center font-extrabold text-sm shadow-sm uppercase">
										{(selectedProduct.farmer || selectedProduct.farmerName || 'F')[0]}
									</div>
									<div>
										<p class="text-sm font-bold text-slate-800 flex items-center gap-1">
											{selectedProduct.farmer || selectedProduct.farmerName || 'AgriConnect Farmer'}
											<span class="material-symbols-outlined text-[15px] text-emerald-500 filled" title="Verified">verified</span>
										</p>
										<p class="text-xs text-slate-400 mt-0.5">{selectedProduct.farmName || 'Local Family Farm'} • {selectedProduct.location || 'Local Fields'}</p>
									</div>
								</div>

								<div class="flex items-center gap-2">
									{#if !isOutOfStock(selectedProduct)}
										<a 
											href="tel:{selectedProduct.farmerPhone || '+919876543210'}" 
											class="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
										>
											📞 Call
										</a>
										<a 
											href="mailto:{selectedProduct.farmerEmail || 'farmer@agriconnect.com'}?subject=Marketplace Inquiry - {selectedProduct.name}" 
											class="bg-primary-green hover:bg-dark-green text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 shadow-md shadow-primary-green/15 transition-all cursor-pointer"
										>
											✉ Send Email
										</a>
									{:else}
										{@const isSubbed = subscribedProductIds.includes(selectedProduct.id)}
										<button
											onclick={() => isSubbed ? unsubscribeAvailability(selectedProduct.id) : subscribeAvailability(selectedProduct.id)}
											disabled={subscribingProductId === selectedProduct.id || unsubscribingProductId === selectedProduct.id}
											class={['text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm',
												isSubbed ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'].join(' ')}
										>
											<span class="material-symbols-outlined text-[15px]">{isSubbed ? 'notifications_active' : 'notification_add'}</span>
											{isSubbed ? 'Subscribed ✓' : 'Notify Me When Available'}
										</button>
									{/if}
								</div>
							</div>
						</div>

					<!-- View 2: Farmer profile view inside modal -->
					{:else}
						<button 
							onclick={() => { currentModalView = 'details'; }} 
							class="text-xs font-bold text-slate-400 hover:text-slate-650 flex items-center gap-1 mb-2 cursor-pointer"
						>
							← Back to product details
						</button>

						<div class="grid gap-6 md:grid-cols-[1fr_2fr] border-b border-slate-100 pb-6">
							<!-- Profile Left -->
							<div class="flex flex-col items-center text-center space-y-3 bg-[#F8FAF5] border border-emerald-100/50 p-5 rounded-2xl">
								<div class="size-20 rounded-full bg-gradient-to-br from-primary-green to-dark-green text-white flex items-center justify-center font-black text-2xl shadow shadow-primary-green/20 uppercase">
									{(selectedProduct.farmName || selectedProduct.farmer || 'F')[0]}
								</div>
								<div>
									<h3 class="font-black text-base text-slate-900 leading-tight flex items-center justify-center gap-1">
										{selectedProduct.farmName || 'Local Family Farm'}
										<span class="material-symbols-outlined text-[16px] text-emerald-500 filled">verified</span>
									</h3>
									<p class="text-xs text-slate-400 mt-1 font-medium">{selectedProduct.location || 'Local Fields'}</p>
								</div>
								{#if selectedProduct.farmerId}
									<button 
										onclick={(e) => toggleFavoriteFarmer(selectedProduct.farmerId, e)}
										class={['text-xs font-bold transition-all px-4 py-1.5 rounded-full border cursor-pointer flex items-center gap-1 shadow-sm w-full justify-center', 
											isFarmerFavorited ? 'bg-amber-500 text-white border-amber-500' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'].join(' ')}
									>
										<span class="material-symbols-outlined text-[13px] {isFarmerFavorited ? 'filled' : ''}">star</span>
										<span>{isFarmerFavorited ? 'Following' : 'Follow Farmer'}</span>
									</button>
								{/if}
							</div>

							<!-- Profile Right -->
							<div class="space-y-4 flex flex-col justify-between text-xs">
								<div class="space-y-2">
									<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">About the Farm</h4>
									<p class="text-slate-500 leading-relaxed font-medium">
										{selectedProduct.farmName || 'Local Family Farm'} is committed to sustainable, eco-friendly farming practices. Providing the highest quality local agriculture produce harvested fresh to preserve nutritional value and natural taste.
									</p>
								</div>

								<div class="grid grid-cols-3 gap-3">
									<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
										<p class="text-lg font-black text-primary-green">
											{produce.filter(i => (i.farmer || i.farmerName) === (selectedProduct.farmer || selectedProduct.farmerName)).length || 1}
										</p>
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Active Lists</p>
									</div>
									<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
										<p class="text-lg font-black text-primary-green">5+</p>
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Years Farming</p>
									</div>
									<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
										<p class="text-lg font-black text-primary-green">150+ TN</p>
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Yield</p>
									</div>
								</div>

								<div class="space-y-2 pt-3 border-t border-slate-100">
									<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Farmer Contact Details</h4>
									<div class="grid gap-2 sm:grid-cols-2 font-semibold text-slate-600">
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[15px] text-primary-green">person</span>
											<span>Farmer: {selectedProduct.farmer || selectedProduct.farmerName || 'AgriConnect Farmer'}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[15px] text-primary-green">pin_drop</span>
											<span>Farm: {selectedProduct.location || 'Local Fields'}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[15px] text-primary-green">call</span>
											<a href="tel:{selectedProduct.farmerPhone || '+919876543210'}" class="hover:text-primary-green hover:underline">{selectedProduct.farmerPhone || '+91 98765 43210'}</a>
										</div>
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[15px] text-primary-green">mail</span>
											<a href="mailto:{selectedProduct.farmerEmail || 'farmer@agriconnect.com'}" class="hover:text-primary-green hover:underline truncate">{selectedProduct.farmerEmail || 'farmer@agriconnect.com'}</a>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

				</div>
	{/if}
</Modal>

</section>

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
