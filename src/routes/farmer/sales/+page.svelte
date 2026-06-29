<script>
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';

	const { data } = $props();

	let sales = $state([]);
	let inventory = $state([]);
	let harvests = $state([]);
	let loading = $state(false);
	let error = $state('');

	$effect(() => {
		sales = data?.sales || [];
		inventory = data?.inventory || [];
		harvests = data?.harvests || [];
	});

	// Helper to find harvest details or crop details for dynamic lifespan calculation
	function getLifespanDetails(itemName, itemHarvestIds = [], itemSourceId = '') {
		if (!itemName || typeof itemName !== 'string') {
			return null;
		}
		const cleanName = itemName.replace(/\s+Harvest$/i, '').trim().toLowerCase();
		
		let matchingHarvest = null;
		if (itemHarvestIds && itemHarvestIds.length > 0) {
			matchingHarvest = harvests.find(h => itemHarvestIds.includes(h.id));
		}
		if (!matchingHarvest && itemSourceId) {
			matchingHarvest = harvests.find(h => h.id === itemSourceId);
		}
		if (!matchingHarvest) {
			matchingHarvest = harvests.find(h => h.cropName.trim().toLowerCase() === cleanName);
		}

		if (matchingHarvest && matchingHarvest.lifespan && matchingHarvest.harvestDate) {
			return {
				lifespan: matchingHarvest.lifespan,
				harvestDate: matchingHarvest.harvestDate
			};
		}
		return null;
	}

	// Calculate remaining lifespan dynamically
	function calculateRemainingLifespan(item) {
		if (item && typeof item === 'object' && item.expiryDate) {
			const expiry = new Date(item.expiryDate + 'T00:00:00');
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const diffMs = expiry.getTime() - today.getTime();
			return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		}

		let lifespanStr = item.lifespan;
		let harvestDateStr = null;

		const details = getLifespanDetails(item.name, item.harvestIds, item.sourceId);
		if (details) {
			lifespanStr = details.lifespan;
			harvestDateStr = details.harvestDate;
		} else if (item.createdAt) {
			harvestDateStr = item.createdAt.split('T')[0];
		}

		if (!lifespanStr || !harvestDateStr) return null;

		const match = lifespanStr.match(/(\d+)/);
		if (!match) return null;

		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(harvestDateStr + 'T00:00:00');
		const expiryDate = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const diffMs = expiryDate.getTime() - today.getTime();
		return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	}

	// ── Computed stats ──────────────────────────────────────────────
	let totalRevenue = $derived.by(() => sales.reduce((s, x) => s + (x.totalAmount || 0), 0));

	let thisMonthRevenue = $derived.by(() => {
		const now = new Date();
		return sales
			.filter(s => {
				const d = new Date(s.saleDate || s.createdAt);
				return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
			})
			.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
	});

	let topItem = $derived.by(() => {
		const map = {};
		for (const s of sales) {
			map[s.itemName] = (map[s.itemName] || 0) + (s.quantity || 0);
		}
		const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
		return sorted[0] ? sorted[0][0] : '—';
	});

	// ── Modal state ──────────────────────────────────────────────────
	let showModal = $state(false);
	let selectedInventoryId = $state('');
	let quantity = $state('');
	let pricePerUnit = $state('');
	let buyerName = $state('');
	let notes = $state('');
	let saleDate = $state(new Date().toISOString().split('T')[0]);

	let selectedItem = $derived.by(() => inventory.find(i => i.id === selectedInventoryId) || null);
	let availableQty = $derived.by(() => {
		if (!selectedItem) return 0;
		const cleanName = selectedItem.name.replace(/\s+Harvest$/i, '').trim().toLowerCase();
		return inventory
			.filter(i => i.name.replace(/\s+Harvest$/i, '').trim().toLowerCase() === cleanName)
			.reduce((sum, i) => sum + Math.max(0, (i.total || 0) - (i.soldUsed || 0)), 0);
	});

	// Auto-fill price per unit when an inventory item is selected
	$effect(() => {
		if (selectedItem) {
			pricePerUnit = selectedItem.price || '';
		}
	});
	let computedTotal = $derived.by(() => {
		const q = Number(quantity);
		const p = Number(pricePerUnit);
		return q > 0 && p >= 0 ? Math.round(q * p * 100) / 100 : 0;
	});

	function openModal() {
		showModal = true;
		selectedInventoryId = '';
		quantity = '';
		pricePerUnit = '';
		buyerName = '';
		notes = '';
		saleDate = new Date().toISOString().split('T')[0];
		error = '';
	}

	function closeModal() {
		showModal = false;
		error = '';
	}

	async function handleAddSale(e) {
		e.preventDefault();
		if (!selectedItem) return;

		const qty = Number(quantity);
		if (qty <= 0 || qty > availableQty) {
			error = `Quantity must be between 1 and ${availableQty} ${selectedItem.unit}`;
			return;
		}

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/sales', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					inventoryId: selectedItem.id,
					itemName: selectedItem.name,
					category: selectedItem.category || '',
					quantity: qty,
					unit: selectedItem.unit || 'Kg',
					pricePerUnit: Number(pricePerUnit),
					buyerName,
					notes,
					saleDate
				})
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.error || 'Failed to add sale');

			await invalidateAll();
			closeModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDelete(sale) {
		if (!confirm(`Delete sale of ${sale.quantity} ${sale.unit} of "${sale.itemName}"? This will restore the stock.`)) return;

		loading = true;
		try {
			const res = await fetch(`/api/sales/${sale.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to delete sale');
			}
			await invalidateAll();
		} catch (err) {
			alert(err.message);
		} finally {
			loading = false;
		}
	}

	// ── Filtering ────────────────────────────────────────────────────
	let searchQuery = $state('');
	let filteredSales = $derived(
		sales.filter(s => {
			const q = searchQuery.trim().toLowerCase();
			if (!q) return true;
			return (
				s.itemName?.toLowerCase().includes(q) ||
				s.buyerName?.toLowerCase().includes(q) ||
				s.category?.toLowerCase().includes(q)
			);
		})
	);

	function formatDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
	}

	function formatCurrency(n) {
		return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
	}
</script>

<svelte:head>
	<title>Sales Log — AgriConnect</title>
</svelte:head>

<section class="px-4 md:px-8 py-6 max-w-screen-xl mx-auto space-y-6">

	<!-- Page header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div>
			<h1 class="font-extrabold text-2xl text-slate-800 tracking-tight">Sales Log</h1>
			<p class="text-slate-400 text-sm mt-0.5 font-medium">Track every sale and keep your inventory accurate automatically.</p>
		</div>
		<button
			onclick={openModal}
			class="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 rounded-xl"
		>
			<span class="material-symbols-outlined text-base">add</span>
			Record Sale
		</button>
	</div>

	<!-- Stats row -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		{#each [
			{ label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: 'currency_rupee', color: 'bg-emerald-50 text-dark-green' },
			{ label: 'This Month', value: formatCurrency(thisMonthRevenue), icon: 'calendar_month', color: 'bg-blue-50 text-blue-700' },
			{ label: 'Total Transactions', value: sales.length.toString(), icon: 'receipt_long', color: 'bg-violet-50 text-violet-700' },
			{ label: 'Top Selling Item', value: topItem, icon: 'trending_up', color: 'bg-amber-50 text-amber-700' }
		] as stat}
			<div class="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm">
				<div class={['size-10 rounded-xl flex items-center justify-center shrink-0', stat.color].join(' ')}>
					<span class="material-symbols-outlined text-[20px]">{stat.icon}</span>
				</div>
				<div class="min-w-0">
					<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
					<p class="font-extrabold text-slate-800 text-sm truncate mt-0.5">{stat.value}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Sales table card -->
	<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
		<!-- Toolbar -->
		<div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
			<h2 class="font-extrabold text-slate-800 text-sm">Transaction History</h2>
			<div class="relative w-full sm:w-64">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
				<input
					type="text"
					placeholder="Search item, buyer…"
					bind:value={searchQuery}
					class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary-green bg-slate-50 focus:bg-white transition-colors"
				/>
			</div>
		</div>

		<!-- Table -->
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
				<thead>
					<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[9px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6 w-[20%]">Item</th>
						<th class="p-4 w-[12%]">Category</th>
						<th class="p-4 text-center w-[10%]">Qty</th>
						<th class="p-4 text-center w-[10%]">Price / Unit</th>
						<th class="p-4 text-center w-[13%]">Total</th>
						<th class="p-4 w-[15%]">Buyer</th>
						<th class="p-4 text-center w-[12%]">Date</th>
						<th class="p-4 pr-6 text-center w-[8%]">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#each filteredSales as sale (sale.id)}
						<tr class="hover:bg-slate-50/40 transition-colors" transition:slide={{ duration: 150 }}>
							<td class="p-4 pl-6">
								<span class="font-bold text-slate-800 line-clamp-1">{sale.itemName}</span>
							</td>
							<td class="p-4">
								<span class="text-slate-400 capitalize">{sale.category || '—'}</span>
							</td>
							<td class="p-4 text-center font-bold text-slate-700">{sale.quantity} {sale.unit}</td>
							<td class="p-4 text-center">{formatCurrency(sale.pricePerUnit)}</td>
							<td class="p-4 text-center">
								<span class="font-extrabold text-dark-green">{formatCurrency(sale.totalAmount)}</span>
							</td>
							<td class="p-4 truncate">
				{#if sale.buyerName}
					{sale.buyerName}
				{:else}
					<span class="text-slate-300 italic">—</span>
				{/if}
			</td>
							<td class="p-4 text-center text-slate-500">{formatDate(sale.saleDate)}</td>
							<td class="p-4 pr-6 text-center">
								<button
									onclick={() => handleDelete(sale)}
									class="text-slate-300 hover:text-red-500 transition-colors p-1"
									title="Delete sale (restores stock)"
								>
									<span class="material-symbols-outlined text-[16px]">delete</span>
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="p-14 text-center">
								<div class="flex flex-col items-center gap-2">
									<span class="material-symbols-outlined text-4xl text-slate-200">point_of_sale</span>
									<p class="font-bold text-slate-400">No sales recorded yet.</p>
									<p class="text-slate-300 text-xs">Click "Record Sale" to log your first transaction.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-slate-100 flex justify-between items-center text-slate-400 text-xs bg-slate-50/50">
			<span>Showing {filteredSales.length} of {sales.length} transactions</span>
		</div>
	</div>

</section>

<!-- Add Sale Modal -->
{#if showModal}
	<div
		role="button"
		tabindex="0"
		aria-label="Close modal"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 bg-slate-950/35 backdrop-blur-xs flex items-center justify-center z-50 p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { closeModal(); } }}
	>
		<div
			transition:slide={{ duration: 200 }}
			class="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
				<h3 class="font-extrabold text-slate-800 text-base">Record Sale</h3>
				<button
					onclick={closeModal}
					class="text-slate-400 hover:text-slate-600 transition-colors size-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
				>
					<span class="material-symbols-outlined text-lg">close</span>
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleAddSale} class="p-6 space-y-4">
				{#if error}
					<div class="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5">
						{error}
					</div>
				{/if}

				<!-- Inventory item select -->
				<div>
					<label for="inventory" class="block text-xs font-bold text-slate-600 mb-1.5">Inventory Item <span class="text-red-400">*</span></label>
					<select
						id="inventory"
						bind:value={selectedInventoryId}
						required
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					>
						<option value="" disabled>Select inventory item…</option>
						{#each inventory.filter(i => (i.total || 0) - (i.soldUsed || 0) > 0) as item}
							{@const daysLeft = calculateRemainingLifespan(item)}
							{@const lifespanDisplay = daysLeft !== null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`) : '—'}
							<option value={item.id}>
								{item.name} — {(item.total || 0) - (item.soldUsed || 0)} {item.unit || 'Kg'} available (lifespan: {lifespanDisplay})
							</option>
						{/each}
					</select>
					{#if selectedItem}
						<p class="text-[10px] text-slate-400 mt-1 font-semibold capitalize">
							Category: {selectedItem.category || '—'} &nbsp;|&nbsp; Available: <span class="text-dark-green font-extrabold">{availableQty} {selectedItem.unit || 'Kg'}</span>
						</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-3">
					<!-- Quantity -->
					<div>
						<label for="quantity" class="block text-xs font-bold text-slate-600 mb-1.5">
							Quantity {selectedItem ? `(${selectedItem.unit || 'Kg'})` : ''} <span class="text-red-400">*</span>
						</label>
						<input
							id="quantity"
							type="number"
							min="0.001"
							max={availableQty || undefined}
							step="any"
							bind:value={quantity}
							required
							placeholder="0"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
						/>
					</div>
					<!-- Price per unit -->
					<div>
						<label for="price" class="block text-xs font-bold text-slate-600 mb-1.5">Price per {selectedItem?.unit || 'Unit'} (₹) <span class="text-red-400">*</span></label>
						<input
							id="price"
							type="number"
							min="0"
							step="any"
							bind:value={pricePerUnit}
							required
							placeholder="0.00"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
						/>
					</div>
				</div>

				<!-- Computed total -->
				{#if computedTotal > 0}
					<div class="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex justify-between items-center">
						<span class="text-xs font-bold text-slate-600">Total Sale Value</span>
						<span class="font-extrabold text-dark-green text-base">{formatCurrency(computedTotal)}</span>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<!-- Buyer name -->
					<div>
						<label for="buyer" class="block text-xs font-bold text-slate-600 mb-1.5">Buyer Name</label>
						<input
							id="buyer"
							type="text"
							bind:value={buyerName}
							placeholder="e.g. Ravi Traders"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
						/>
					</div>
					<!-- Sale date -->
					<div>
						<label for="sale-date" class="block text-xs font-bold text-slate-600 mb-1.5">Sale Date <span class="text-red-400">*</span></label>
						<input
							id="sale-date"
							type="date"
							bind:value={saleDate}
							required
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
						/>
					</div>
				</div>

				<!-- Notes -->
				<div>
					<label for="notes" class="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows="2"
						placeholder="Optional notes…"
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green resize-none"
					></textarea>
				</div>

				<!-- Actions -->
				<div class="flex gap-3 pt-2 border-t border-slate-100">
					<button
						type="button"
						onclick={closeModal}
						class="btn-secondary flex-1 py-3 text-xs"
					>Cancel</button>
					<button
						type="submit"
						disabled={loading || !selectedInventoryId}
						class="btn-primary flex-1 py-3 text-xs"
					>
						{loading ? 'Saving…' : 'Record Sale'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
