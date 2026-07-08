<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { showAlert } from '$lib/modal.svelte.js';
	import { formatCurrencyGlobal, getCurrencySymbolGlobal } from '$lib/preferences.svelte.js';

	let { data } = $props();

	// State
	let produce = $state([]);
	let wishlistIds = $state([]);
	let favoriteFarmerIds = $state([]);
	let subscribedProductIds = $state([]);

	let subscribingProductId = $state(null);
	let unsubscribingProductId = $state(null);

	// Price Trend State
	let priceHistory = $state([]);
	let priceHistoryLoading = $state(false);
	let priceTrendFilter = $state('all');
	let priceChartCanvas = $state(null);
	let priceChartInstance = null;

	// Sync datasets dynamically
	$effect(() => {
		produce = data.produce || [];
		wishlistIds = data.settings?.wishlist || [];
		favoriteFarmerIds = data.settings?.favoriteFarmers || [];
		const subs = data.subscriptions || [];
		subscribedProductIds = subs.map(s => s.productId);
	});

	// Derived wishlist mappings
	let wishlistProducts = $derived(produce.filter(p => wishlistIds.includes(p.id)));

	// Persisted states
	let compareList = $state([]);
	onMount(() => {
		if (browser) {
			try {
				const saved = localStorage.getItem('cust_compare_list');
				if (saved) compareList = JSON.parse(saved);
			} catch (e) {
				console.error(e);
			}
		}
	});

	$effect(() => {
		if (browser) {
			localStorage.setItem('cust_compare_list', JSON.stringify(compareList));
		}
	});

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
		if (browser) {
			try {
				const saved = localStorage.getItem('cust_recent_viewed');
				let recent = saved ? JSON.parse(saved) : [];
				recent = recent.filter(item => item.id !== product.id);
				recent = [product, ...recent].slice(0, 15);
				localStorage.setItem('cust_recent_viewed', JSON.stringify(recent));
			} catch (e) {
				console.error(e);
			}
		}
		
		fetchPriceHistory(product.id);
	}

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

	$effect(() => {
		const _ = [filteredPriceHistory, priceChartCanvas];
		if (browser && priceChartCanvas && filteredPriceHistory.length >= 2) {
			tick().then(() => renderPriceChart());
		}
	});

	function isOutOfStock(product) {
		return Number(product.quantity || 0) === 0;
	}
</script>

<svelte:head>
	<title>My Wishlist - Agri-Sphere</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6 text-slate-800 bg-[#F8FAF5] min-h-[85vh] p-1 rounded-3xl">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2 border-b border-emerald-100 pb-5">
		<div>
			<h1 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-red-500">❤️</span> Saved Wishlist
			</h1>
			<p class="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
				View and monitor listed produce items you have bookmarked.
			</p>
		</div>
	</div>

	<!-- Dedicated Wishlist Tab View -->
	<div class="space-y-4 animate-fade-in">
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
							onclick={(e) => toggleWishlist(crop.id, e)}
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
					<a href="/customer/dashboard" class="mt-3 btn-primary text-xs px-4 py-2 cursor-pointer inline-block">Browse Produce</a>
				</div>
			{/each}
		</div>
	</div>

	<!-- View Details Modal -->
	<Modal bind:show={showProductModal} size="xl" title="Product Specification" type="custom">
		{#if selectedProduct}
			{@const isFarmerFavorited = favoriteFarmerIds.includes(selectedProduct.farmerId)}
			<div class="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
						<p class="text-slate-650 leading-relaxed font-normal text-xs">{selectedProduct.description || 'No additional description provided.'}</p>
					</div>

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

					<!-- Price Trend -->
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

							<div class="bg-white border border-slate-100 rounded-xl p-3" style="height: 200px;">
								<canvas bind:this={priceChartCanvas}></canvas>
							</div>
						{:else}
							<div class="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
								<span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">show_chart</span>
								<p class="text-xs font-bold text-slate-400">Not enough price history available.</p>
							</div>
						{/if}
					</div>

					<!-- Farmer Card -->
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
										{selectedProduct.farmer || selectedProduct.farmerName || 'Agri-Sphere Farmer'}
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
										href="mailto:{selectedProduct.farmerEmail || 'farmer@agrisphere.com'}?subject=Marketplace Inquiry - {selectedProduct.name}" 
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

				<!-- Farmer Profile View -->
				{:else}
					<button 
						onclick={() => { currentModalView = 'details'; }} 
						class="text-xs font-bold text-slate-400 hover:text-slate-650 flex items-center gap-1 mb-2 cursor-pointer"
					>
						← Back to product details
					</button>

					<div class="grid gap-6 md:grid-cols-[1fr_2fr] border-b border-slate-100 pb-6">
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
										<span>Farmer: {selectedProduct.farmer || selectedProduct.farmerName || 'Agri-Sphere Farmer'}</span>
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
										<a href="mailto:{selectedProduct.farmerEmail || 'farmer@agrisphere.com'}" class="hover:text-primary-green hover:underline truncate">{selectedProduct.farmerEmail || 'farmer@agrisphere.com'}</a>
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
