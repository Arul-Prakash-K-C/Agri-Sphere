<script>
	let {
		farmer = {},
		onUnfollow = null,
		onViewListings = null
	} = $props();
</script>

<div class="bg-white dark:bg-[#1e1e1e] border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow relative">
	<!-- Unfollow overlay -->
	{#if onUnfollow}
		<button 
			onclick={(e) => { e.stopPropagation(); onUnfollow(farmer.farmerId, e); }}
			class="absolute top-4 right-4 size-7 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center text-slate-450 cursor-pointer"
			title="Unfollow Farmer"
		>
			<span class="material-symbols-outlined text-[15px]">close</span>
		</button>
	{/if}

	<div class="flex items-center gap-3.5">
		<div class="size-12 rounded-full bg-linear-to-tr from-primary-green to-dark-green text-white flex items-center justify-center font-black text-base uppercase shadow-sm">
			{farmer.farmerName ? farmer.farmerName[0] : 'F'}
		</div>
		<div>
			<h4 class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1">
				{farmer.farmerName}
				<span class="material-symbols-outlined text-[15px] text-emerald-500 filled">verified</span>
			</h4>
			<p class="text-xs text-slate-400 mt-0.5 flex items-center gap-0.5">
				<span class="material-symbols-outlined text-[13px]">pin_drop</span> {farmer.location}
			</p>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-[#F8FAF5]/60 dark:bg-slate-900/50 border border-emerald-100/40 dark:border-slate-800 p-3 rounded-xl">
		<div>
			<span class="text-slate-400 block">Listed Crops</span>
			<strong class="text-slate-800 dark:text-slate-200 text-xs">{farmer.activeProductsCount} Items</strong>
		</div>
		<div>
			<span class="text-slate-400 block">Phone Contact</span>
			<a href="tel:{farmer.phone}" class="text-primary-green hover:underline block truncate mt-0.5">{farmer.phone}</a>
		</div>
	</div>

	<div class="flex gap-2">
		<button 
			onclick={() => onViewListings?.(farmer.farmerName)}
			class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl flex-1 cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-sm shadow-emerald-600/10"
		>
			<span class="material-symbols-outlined text-[16px]">grid_view</span> View Listings
		</button>
	</div>
</div>
