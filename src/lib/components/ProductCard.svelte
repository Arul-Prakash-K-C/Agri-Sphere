<script>
	let {
		product = {},
		wishlistIds = [],
		compareList = [],
		subscribedProductIds = [],
		subscribingProductId = null,
		unsubscribingProductId = null,
		onViewDetails = null,
		onToggleComparison = null,
		onToggleWishlist = null,
		onSubscribeAvailability = null,
		onUnsubscribeAvailability = null,
	} = $props();

	const isWishlisted = $derived(wishlistIds.includes(product.id));
	const isCompared = $derived(compareList.some((p) => p.id === product.id));
	const isOutOfStock = $derived(Number(product.quantity || 0) === 0);
	const isSubscribed = $derived(subscribedProductIds.includes(product.id));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	onclick={(e) => onViewDetails?.(product, e)}
	class="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer relative"
>
	<!-- Save to wishlist and Compare action overlays -->
	<div class="absolute top-3 right-3 flex gap-2 z-10">
		{#if onToggleComparison}
			<button
				onclick={(e) => {
					e.stopPropagation();
					onToggleComparison(product, e);
				}}
				class={[
					"size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm",
					isCompared
						? "bg-emerald-600 text-white border-emerald-600"
						: "bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-emerald-600",
				].join(" ")}
				title="Compare product"
			>
				<span class="material-symbols-outlined text-[16px]"
					>compare_arrows</span
				>
			</button>
		{/if}
		{#if onToggleWishlist}
			<button
				onclick={(e) => {
					e.stopPropagation();
					onToggleWishlist(product.id, e);
				}}
				class={[
					"size-8 rounded-xl flex items-center justify-center border shadow-sm transition-all cursor-pointer backdrop-blur-sm",
					isWishlisted
						? "bg-white dark:bg-slate-900 text-red-500 border-slate-200 dark:border-slate-850"
						: "bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-500",
				].join(" ")}
				title={isWishlisted
					? "Remove from Wishlist"
					: "Add to Wishlist"}
			>
				<span
					class="material-symbols-outlined text-[16px] {isWishlisted
						? 'filled'
						: ''}">favorite</span
				>
			</button>
		{/if}
	</div>

	<div class="h-40 w-full relative overflow-hidden shrink-0">
		<img
			src={product.imageUrl ||
				"https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80"}
			alt={product.name}
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
		/>
		<div
			class="absolute inset-0 bg-linear-to-t from-black/55 to-transparent"
		></div>
		<div class="absolute bottom-2.5 left-3 text-white pr-10">
			<h4 class="font-extrabold text-sm leading-tight truncate">
				{product.name}
			</h4>
			<p
				class="text-[9px] text-white/85 font-bold flex items-center gap-0.5 mt-0.5"
			>
				{product.farmer || product.farmerName || "Verified Farmer"}
				<span
					class="material-symbols-outlined text-[11px] text-emerald-400 filled"
					>verified</span
				>
			</p>
		</div>
		{#if isOutOfStock}
			<div
				class="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1"
			>
				<span class="material-symbols-outlined text-[12px]">block</span>
				Out of Stock
			</div>
		{/if}
	</div>

	<div class="p-3.5 grow flex flex-col justify-between gap-3.5">
		<div class="flex justify-between items-center text-[10px]">
			<span
				class="bg-emerald-50 text-dark-green border border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
			>
				{product.category || "Produce"}
			</span>
			<span
				class="text-slate-400 font-bold flex items-center gap-0.5 truncate max-w-[100px]"
			>
				<span class="material-symbols-outlined text-[12px]"
					>pin_drop</span
				>
				{product.location || product.farmLocation || "Local Fields"}
			</span>
		</div>

		<div
			class="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100/50 dark:border-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
		>
			<div class="flex justify-between">
				<span>Available Stock</span>
				<strong
					class={isOutOfStock
						? "text-red-500"
						: "text-slate-750 dark:text-slate-200"}
					>{isOutOfStock
						? "Out of Stock"
						: `${product.quantity || "30"} ${product.unit || "KG"}`}</strong
				>
			</div>
			<div class="flex justify-between">
				<span>Harvest Date</span>
				<strong class="text-slate-750 dark:text-slate-200"
					>{product.harvestDate || "Recently"}</strong
				>
			</div>
		</div>

		<div
			class="border-t border-slate-50 dark:border-slate-800/60 pt-2 flex justify-between items-center"
		>
			<div>
				<p
					class="text-[8px] font-bold text-slate-400 uppercase tracking-wider"
				>
					Direct Price
				</p>
				<p class="text-sm font-black text-emerald-600 mt-0.5">
					₹{product.price}
					<span class="text-[9px] text-slate-400 font-normal"
						>/ {product.unit || "KG"}</span
					>
				</p>
			</div>
			{#if isOutOfStock && onSubscribeAvailability}
				<button
					onclick={(e) => {
						e.stopPropagation();
						isSubscribed
							? onUnsubscribeAvailability?.(product.id)
							: onSubscribeAvailability?.(product.id);
					}}
					disabled={subscribingProductId === product.id ||
						unsubscribingProductId === product.id}
					class={[
						"text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer disabled:opacity-60",
						isSubscribed
							? "bg-red-50 text-red-600 border-red-150 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50"
							: "bg-emerald-50 text-emerald-700 border-emerald-150 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
					].join(" ")}
				>
					<span class="material-symbols-outlined text-[13px]"
						>{isSubscribed
							? "notifications_off"
							: "notifications_active"}</span
					>
					<span>{isSubscribed ? "Unsubscribe" : "Notify"}</span>
				</button>
			{/if}
		</div>
	</div>
</div>
