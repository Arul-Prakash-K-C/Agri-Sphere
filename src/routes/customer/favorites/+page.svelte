<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { formatCurrencyGlobal, getCurrencySymbolGlobal } from '$lib/preferences.svelte.js';

	let { data } = $props();

	// State
	let produce = $state([]);
	let favoriteFarmerIds = $state([]);

	// Sync datasets dynamically
	$effect(() => {
		produce = data.produce || [];
		favoriteFarmerIds = data.settings?.favoriteFarmers || [];
	});

	// Derived favorite farmers listings
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
						email: p.farmerEmail || 'farmer@agrisphere.com',
						activeProductsCount: 0
					};
				}
				farmersMap[p.farmerId].activeProductsCount++;
			}
		});
		return Object.values(farmersMap);
	});

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

	function viewFarmerListings(farmerName) {
		if (browser) {
			localStorage.setItem('cust_search', farmerName);
			window.location.href = '/customer/dashboard';
		}
	}
</script>

<svelte:head>
	<title>Favorite Farmers - Agri-Sphere</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6 text-slate-800 bg-[#F8FAF5] min-h-[85vh] p-1 rounded-3xl">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2 border-b border-emerald-100 pb-5">
		<div>
			<h1 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-amber-500">⭐</span> Favorite Farmers
			</h1>
			<p class="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
				Quickly access product listings and origins of your favorite farm partners.
			</p>
		</div>
	</div>

	<!-- Dedicated Favorite Farmers followed view -->
	<div class="space-y-4 animate-fade-in">
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
							<p class="text-xs text-slate-400 mt-0.5 flex items-center gap-0.5">
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
					<a href="/customer/dashboard" class="mt-3 btn-primary text-xs px-4 py-2 cursor-pointer inline-block">Browse Produce</a>
				</div>
			{/each}
		</div>
	</div>
</section>
