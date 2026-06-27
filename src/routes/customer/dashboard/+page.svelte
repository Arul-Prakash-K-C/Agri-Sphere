<script>
	import { fade, scale } from 'svelte/transition';

	let { data } = $props();

	let produce = $derived(data.produce || []);
	let orders = $derived(data.orders || []);

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
	import { browser } from '$app/environment';

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
		// Run whenever search filters change
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
</script>

<svelte:head>
	<title>Customer Dashboard - AgriConnect</title>
</svelte:head>

<!-- Main Container -->
<section class="max-w-[1440px] mx-auto space-y-6 text-slate-800 bg-[#F8FAF5] min-h-[85vh] p-1 rounded-3xl">
	
	<!-- Top Welcome & Tabs -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4 border-b border-emerald-100 pb-5">
		<div>
			<h1 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">🌾</span> Produce Marketplace
			</h1>
			<p class="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
				Direct connection between verified farmers and local buyers. Arrange deliveries, quantities, and pricing negotiations directly—no transaction fees, no commissions.
			</p>
		</div>
		<div>
			<span class="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-2xl max-w-xs truncate inline-block">
				📍 Shipping to: <strong class="text-dark-green">{shippingAddress}</strong>
			</span>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
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

		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
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

		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
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

		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
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
	<div class="bg-white border border-emerald-100/60 rounded-2xl p-5 shadow-sm space-y-4">
		<div class="grid gap-4 md:grid-cols-12 items-center">
			
			<!-- Search query -->
			<div class="relative md:col-span-4 w-full">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
				<input 
					type="text" 
					bind:value={searchQuery}
					placeholder="Search crops, farms, location..." 
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2 pl-9 pr-4 text-xs font-semibold focus:ring-2 focus:ring-primary-green focus:bg-white transition-all outline-none"
				/>
			</div>

			<!-- Location filter -->
			<div class="relative md:col-span-3 w-full">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">pin_drop</span>
				<input 
					type="text" 
					bind:value={filterLocation}
					placeholder="Filter by farm location..." 
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2 pl-9 pr-4 text-xs font-semibold focus:ring-2 focus:ring-primary-green focus:bg-white transition-all outline-none"
				/>
			</div>

			<!-- Max Price Filter -->
			<div class="relative md:col-span-3 w-full flex items-center gap-2">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Max Price (₹)</span>
				<input 
					type="number" 
					bind:value={filterMaxPrice}
					placeholder="Any" 
					min="0"
					step="1"
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2 px-3.5 text-xs font-semibold focus:ring-2 focus:ring-primary-green focus:bg-white transition-all outline-none"
				/>
			</div>

			<!-- Sort controls -->
			<div class="md:col-span-2 flex items-center gap-2">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Sort</span>
				<select 
					bind:value={sortBy} 
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2 px-3 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-primary-green/20 outline-none"
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

	<!-- Marketplace Grid and Side widgets -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Marketplace Crops Cards (3 cols on desktop) -->
		<div class="lg:col-span-9 space-y-4">
			<div class="flex justify-between items-center mb-1">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Verified Produce Available</h3>
				<span class="text-xs font-semibold text-slate-400">{filteredProduce.length} listings found</span>
			</div>

			<!-- Product grid (4-column on desktop/XL, 2-column on tablet, single-column on mobile) -->
			<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
				{#if isFiltering}
					{#each Array(4) as _}
						<div class="bg-white rounded-2xl border border-slate-200/50 p-4 space-y-3.5 shadow-sm animate-pulse flex flex-col">
							<div class="h-40 bg-slate-200 rounded-xl w-full skeleton relative overflow-hidden">
								<div class="absolute bottom-2.5 left-3 space-y-1.5">
									<div class="skeleton h-4 w-28 rounded"></div>
									<div class="skeleton h-3 w-20 rounded"></div>
								</div>
							</div>
							<div class="flex-grow flex flex-col justify-between gap-3.5">
								<div class="flex justify-between items-center text-[10px]">
									<div class="skeleton h-4.5 w-14 rounded-full"></div>
									<div class="skeleton h-4 w-16 rounded"></div>
								</div>
								<div class="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50 text-[10px]">
									<div class="flex justify-between py-0.5"><div class="skeleton h-3 w-16 rounded"></div><div class="skeleton h-3 w-10 rounded"></div></div>
									<div class="flex justify-between py-0.5"><div class="skeleton h-3 w-14 rounded"></div><div class="skeleton h-3 w-12 rounded"></div></div>
								</div>
								<div class="pt-2 border-t border-slate-50 space-y-1">
									<div class="skeleton h-2 w-12 rounded"></div>
									<div class="skeleton h-4.5 w-16 rounded"></div>
								</div>
								<div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
									<div class="skeleton h-6 w-full rounded-lg"></div>
									<div class="skeleton h-6 w-full rounded-lg"></div>
								</div>
								<div class="skeleton h-6 w-full rounded-lg"></div>
							</div>
						</div>
					{/each}
				{:else}
					{#each filteredProduce as crop (crop.id)}
						<div 
							role="button"
							tabindex="0"
							onclick={(e) => viewDetails(crop, e)}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && viewDetails(crop, e)}
							class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
						>
							<div class="h-40 w-full relative overflow-hidden flex-shrink-0">
								<img src={crop.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={crop.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
								<div class="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
								<div class="absolute bottom-2.5 left-3 text-white">
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

								<!-- Stock & Harvest Info -->
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

								<!-- Price display in Rupees -->
								<div class="border-t border-slate-50 pt-2 flex justify-between items-center">
									<div>
										<p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Direct Price</p>
										<p class="text-sm font-black text-primary-green mt-0.5">
											₹{crop.price} 
											<span class="text-[9px] text-slate-400 font-normal">/ {crop.unit || 'KG'}</span>
										</p>
									</div>
								</div>

								<!-- Action Buttons on Card -->
								<div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 flex-shrink-0">
									<a 
										href="tel:{crop.farmerPhone || '+919876543210'}" 
										onclick={(e) => e.stopPropagation()}
										class="bg-emerald-50 hover:bg-emerald-100 text-dark-green text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-0.5 shadow-sm transition-all border border-emerald-200/50 cursor-pointer"
									>
										📞 Call
									</a>
									<a 
										href="mailto:{crop.farmerEmail || 'farmer@agriconnect.com'}?subject=AgriConnect Sourcing - {crop.name}" 
										onclick={(e) => e.stopPropagation()}
										class="bg-primary-green hover:bg-dark-green text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-0.5 shadow transition-all cursor-pointer"
									>
										✉ Email
									</a>
								</div>
								<button 
									onclick={(e) => viewDetails(crop, e)}
									class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1.5 rounded-lg border border-slate-200/50 transition-all flex items-center justify-center gap-0.5 cursor-pointer"
								>
									View Details
								</button>
							</div>
						</div>
					{:else}
						<!-- Empty State -->
						<div class="col-span-full py-16 px-4 text-center bg-white border border-slate-200/50 rounded-2xl shadow-sm space-y-4">
							<svg class="mx-auto size-24 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/>
								<path d="M12 6v6l4 2"/>
								<circle cx="12" cy="12" r="10" />
							</svg>
							<p class="text-slate-500 font-bold text-sm">No produce available at the moment.</p>
							<button 
								onclick={resetFilters}
								class="mt-2 bg-primary-green hover:bg-dark-green text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition-colors cursor-pointer"
							>
								Browse Other Categories
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Right Side Widgets (3 cols on desktop) -->
		<div class="lg:col-span-3 space-y-6">
			<!-- Escrow Quality Guarantee -->
			<div class="glass-card rounded-2xl p-6 bg-gradient-to-br from-emerald-50/50 to-white/70 space-y-3 border border-emerald-100">
				<h3 class="text-sm font-bold text-dark-green uppercase tracking-wider">🛡️ Escrow Protected Sourcing</h3>
				<p class="text-xs text-slate-500 leading-relaxed">
					All trades on AgriConnect are protected. Payments remain in escrow until harvest inspection reports are uploaded and confirmed.
				</p>
			</div>
			
			<button 
				onclick={resetFilters}
				class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 rounded-full border border-slate-200/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
			>
				<span class="material-symbols-outlined text-[16px]">restart_alt</span>
				Clear All Filters
			</button>
		</div>

	</div>

	<!-- PRODUCT DETAILS / FARMER PROFILE MODAL -->
	{#if showProductModal && selectedProduct}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:scale={{ duration: 200, start: 0.95 }} class="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
				
				<!-- Modal Header -->
				<div class="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0">
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Marketplace</span>
						<span class="text-slate-300">/</span>
						<span class="text-xs font-bold text-primary-green uppercase tracking-wider">{selectedProduct.category || 'Produce'}</span>
					</div>
					<button onclick={() => { showProductModal = false; }} class="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100 flex items-center cursor-pointer">
						<span class="material-symbols-outlined text-xl">close</span>
					</button>
				</div>

				<!-- Modal Scrollable Content Container -->
				<div class="overflow-y-auto p-6 space-y-6">
					
					<!-- View 1: Product details -->
					{#if currentModalView === 'details'}
						<div class="grid gap-6 md:grid-cols-2">
							<!-- Product Image Left -->
							<div class="rounded-2xl overflow-hidden border border-emerald-100/50 bg-slate-50 h-64 md:h-80 relative shadow-sm">
								<img src={selectedProduct.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={selectedProduct.name} class="w-full h-full object-cover" />
								<span class="absolute top-3 left-3 bg-emerald-500 text-white text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full flex items-center gap-0.5 shadow">
									<span class="material-symbols-outlined text-[12px]">verified</span>
									Verified Farm
								</span>
							</div>

							<!-- Details Right -->
							<div class="flex flex-col justify-between">
								<div class="space-y-4">
									<h2 class="text-2xl font-black text-slate-900 leading-tight">{selectedProduct.name}</h2>
									
									<div class="flex flex-wrap items-center gap-2">
										<span class="bg-[#DCFCE7] text-dark-green text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200/50">
											Price: ₹{selectedProduct.price} / {selectedProduct.unit || 'KG'}
										</span>
										<span class="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">
											Stock: {selectedProduct.quantity} {selectedProduct.unit || 'KG'}
										</span>
									</div>

									<p class="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
										{selectedProduct.description || 'Freshly harvested local agricultural product. Certified for quality and sourced directly.'}
									</p>
								</div>

								<!-- Date & Location Footer -->
								<div class="pt-4 mt-4 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-500">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[16px] text-primary-green">calendar_month</span>
										<span>Harvest Date: <strong class="text-slate-700">{selectedProduct.harvestDate || 'Recently Harvested'}</strong></span>
									</div>
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[16px] text-primary-green">pin_drop</span>
										<span>Farm Origin: <strong class="text-slate-700">{selectedProduct.location || 'Local Fields'}</strong></span>
									</div>
								</div>
							</div>
						</div>

						<!-- Farmer Information Card -->
						<div class="bg-[#F8FAF5] border border-emerald-100/50 rounded-2xl p-5 mt-4 space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Farmer Information</h4>
								<button 
									onclick={() => { currentModalView = 'profile'; }}
									class="text-xs font-bold text-primary-green hover:text-dark-green hover:underline flex items-center gap-0.5 cursor-pointer"
								>
									View Full Farm Profile →
								</button>
							</div>

							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div class="flex items-center gap-3">
									<!-- Farmer Avatar -->
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

								<!-- Direct Action Buttons -->
								<div class="flex items-center gap-2">
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
								</div>
							</div>
						</div>

						<!-- Contact section negotiations notice -->
						<div class="bg-gradient-to-br from-emerald-100/40 to-emerald-50/20 border border-emerald-200/50 rounded-2xl p-5 text-center space-y-2">
							<h3 class="font-extrabold text-dark-green text-base">Interested in this produce?</h3>
							<p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
								Delivery, quantity, and pricing negotiations are handled directly between the buyer and farmer.
							</p>
							<div class="flex justify-center gap-3 pt-2">
								<a 
									href="tel:{selectedProduct.farmerPhone || '+919876543210'}" 
									class="bg-white hover:bg-slate-100 border border-emerald-200 text-dark-green text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
								>
									📞 Call Farmer
								</a>
								<a 
									href="mailto:{selectedProduct.farmerEmail || 'farmer@agriconnect.com'}?subject=Inquiry about {selectedProduct.name}" 
									class="bg-white hover:bg-slate-100 border border-emerald-200 text-dark-green text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
								>
									✉ Email Farmer
								</a>
							</div>
						</div>
					
					<!-- View 2: Farmer profile -->
					{:else}
						<button 
							onclick={() => { currentModalView = 'details'; }} 
							class="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2 cursor-pointer"
						>
							← Back to product details
						</button>

						<!-- Profile header card -->
						<div class="grid gap-6 md:grid-cols-[1fr_2fr] border-b border-slate-100 pb-6">
							<!-- Profile Left -->
							<div class="flex flex-col items-center text-center space-y-3 bg-[#F8FAF5] border border-emerald-100/50 p-5 rounded-2xl">
								<!-- Farm Avatar -->
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

								<div class="bg-white border border-emerald-100/50 rounded-full px-3 py-1 text-[10px] font-bold text-primary-green uppercase tracking-wider">
									Verified Supplier
								</div>
							</div>

							<!-- Profile Right (Details) -->
							<div class="space-y-4 flex flex-col justify-between text-xs">
								<div class="space-y-2">
									<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">About the Farm</h4>
									<p class="text-slate-500 leading-relaxed font-medium">
										{selectedProduct.farmName || 'Local Family Farm'} is committed to sustainable, eco-friendly farming practices. Providing the highest quality local agriculture produce harvested fresh to preserve nutritional value and natural taste.
									</p>
								</div>

								<!-- Statistics Bento block -->
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

								<!-- Contact details -->
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

						<!-- Farmer's Other Products -->
						<div class="space-y-3 pt-3">
							<h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Other available products from this farm</h4>
							<div class="grid gap-4 sm:grid-cols-2">
								{#each produce.filter(item => (item.farmer || item.farmerName) === (selectedProduct.farmer || selectedProduct.farmerName) && item.id !== selectedProduct.id) as otherProd}
									<button 
										onclick={() => { selectedProduct = otherProd; currentModalView = 'details'; }}
										class="flex items-center gap-3 p-2 bg-[#F8FAF5]/40 border border-emerald-100 hover:bg-[#F8FAF5] rounded-xl text-left transition-colors cursor-pointer group"
									>
										<img src={otherProd.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'} alt={otherProd.name} class="size-12 rounded-lg object-cover" />
										<div class="flex-grow min-w-0">
											<p class="font-bold text-slate-800 text-xs truncate group-hover:text-primary-green transition-colors">{otherProd.name}</p>
											<p class="text-[10px] text-slate-400 mt-0.5 font-medium">{otherProd.quantity || '0'} {otherProd.unit || 'KG'} • ₹{otherProd.price || '0'}/{otherProd.unit || 'KG'}</p>
										</div>
									</button>
								{:else}
									<p class="text-[10px] text-slate-400 font-semibold italic">No other listings from this farmer at this moment.</p>
								{/each}
							</div>
						</div>
					{/if}

				</div>
			</div>
		</div>
	{/if}

</section>

<style>
	/* Custom scrollbar reset */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
