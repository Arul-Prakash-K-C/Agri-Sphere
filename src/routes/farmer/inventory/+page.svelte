<script>
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Reactive bindings from load data
	let stockItems = $state([]);
	let crops = $state([]);
	let harvests = $state([]);

	// Utilization
	let silo1Full = $state(0);
	let silo2Full = $state(0);
	let coldStorageFull = $state(0);

	$effect(() => {
		stockItems = data.inventory || [];
		crops = data.crops || [];
		harvests = data.harvests || [];
		silo1Full = data.settings?.silo1 || 0;
		silo2Full = data.settings?.silo2 || 0;
		coldStorageFull = data.settings?.coldStorage || 0;
	});

	let filterCategory = $state('All'); // 'All' | 'Fruits' | 'Vegetables' | 'Seeds' | 'Chemicals' | 'Fertilizers' | 'Grains' | 'Others'
	let editStorageMode = $state(false);

	let loading = $state(false);
	let error = $state('');

	// Helper to find harvest details or crop details for dynamic lifespan calculation
	function getLifespanDetails(itemName) {
		const cleanName = itemName.replace(/\s+Harvest$/i, '').trim().toLowerCase();
		
		// 1. Look in harvests
		const matchingHarvest = harvests.find(h => h.cropName.trim().toLowerCase() === cleanName);
		if (matchingHarvest && matchingHarvest.lifespan && matchingHarvest.harvestDate) {
			return {
				lifespan: matchingHarvest.lifespan,
				harvestDate: matchingHarvest.harvestDate
			};
		}

		// 2. Fallback to crops
		const matchingCrop = crops.find(c => c.name.trim().toLowerCase() === cleanName);
		if (matchingCrop && matchingCrop.harvestDuration && matchingCrop.plantedDate) {
			return {
				lifespan: matchingCrop.harvestDuration,
				harvestDate: matchingCrop.plantedDate
			};
		}

		return null;
	}

	// Calculate remaining lifespan dynamically
	function calculateRemainingLifespan(itemName) {
		const details = getLifespanDetails(itemName);
		if (!details) return null;

		const match = details.lifespan.match(/(\d+)/);
		if (!match) return null;

		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(details.harvestDate + 'T00:00:00');
		const expiryDate = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const diffMs = expiryDate.getTime() - today.getTime();
		return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	}

	// Determine status string
	function determineStatus(item) {
		const available = (item.total || 0) - (item.soldUsed || 0);
		if (available <= 0) return { label: 'Out of Stock', color: 'bg-red-50 text-red-700 border-red-100' };

		const days = calculateRemainingLifespan(item.name);
		if (days !== null) {
			if (days <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-300' };
			if (days <= 2) return { label: 'Near Expiry', color: 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' };
		}

		return { label: 'Fresh', color: 'bg-emerald-50 text-dark-green border-emerald-100' };
	}

	// Dynamic categorisation filter match
	let filteredItems = $derived.by(() => {
		if (filterCategory === 'All') return stockItems;
		return stockItems.filter(item => {
			const cat = item.category ? item.category.trim().toLowerCase() : '';
			const filter = filterCategory.trim().toLowerCase();
			// Map seeds category
			if (filter === 'seeds' && (cat === 'seeds' || cat === 'seed')) return true;
			if (filter === 'fertilizers' && (cat === 'fertilizers' || cat === 'fertilizer')) return true;
			return cat === filter;
		});
	});

	// Save Storage Utilization levels
	async function saveStorageSettings() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_settings',
					silo1: silo1Full,
					silo2: silo2Full,
					coldStorage: coldStorageFull
				})
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to update storage levels');
			}
			editStorageMode = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Change Unit dynamically on table select
	async function changeUnit(itemId, unit) {
		try {
			const res = await fetch('/api/inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_unit',
					itemId,
					unit
				})
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to update unit');
			}
			stockItems = stockItems.map(item => item.id === itemId ? { ...item, unit } : item);
		} catch (err) {
			alert(err.message);
		}
	}
</script>

<svelte:head>
	<title>Inventory Management - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory Control</h1>
			<p class="text-sm text-slate-500 mt-1">Review storage logs, manage metric units, and track lifespans.</p>
		</div>
	</div>

	<!-- Dashboard Bento Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Storage Utilization Widget (4 cols) -->
		<div class="lg:col-span-4">
			<div class="glass-card rounded-2xl p-6 space-y-5 bg-white h-full flex flex-col justify-between">
				<div>
					<div class="flex justify-between items-center mb-4">
						<h3 class="font-extrabold text-slate-800 text-base flex items-center gap-2">
							<span class="material-symbols-outlined text-primary-green">warehouse</span>
							Storage Utilization
						</h3>
						{#if !editStorageMode}
							<button 
								onclick={() => editStorageMode = true} 
								class="text-xs font-bold text-primary-green hover:underline flex items-center gap-1"
							>
								<span class="material-symbols-outlined text-sm">edit</span> Edit
							</button>
						{/if}
					</div>

					{#if editStorageMode}
						<form onsubmit={(e) => { e.preventDefault(); saveStorageSettings(); }} class="space-y-4 text-xs font-bold text-slate-700">
							<label class="block">
								<span class="block mb-1">Silo 1 (Grain) %</span>
								<input type="number" min="0" max="100" bind:value={silo1Full} class="input-field w-full text-xs" />
							</label>
							<label class="block">
								<span class="block mb-1">Silo 2 (Seed) %</span>
								<input type="number" min="0" max="100" bind:value={silo2Full} class="input-field w-full text-xs" />
							</label>
							<label class="block">
								<span class="block mb-1">Cold Storage %</span>
								<input type="number" min="0" max="100" bind:value={coldStorageFull} class="input-field w-full text-xs" />
							</label>
							
							{#if error}
								<div class="text-red-500 text-xs">{error}</div>
							{/if}

							<div class="flex gap-2 pt-2">
								<button type="button" onclick={() => editStorageMode = false} class="btn-secondary flex-1 py-2 text-xs">Cancel</button>
								<button type="submit" disabled={loading} class="btn-primary flex-1 py-2 text-xs">
									{loading ? 'Saving...' : 'Save'}
								</button>
							</div>
						</form>
					{:else}
						<div class="space-y-5">
							<div>
								<div class="flex justify-between text-xs font-semibold mb-1.5">
									<span class="text-slate-700">Silo 1 (Grain)</span>
									<span class="text-slate-400 font-bold">{silo1Full}% Full</span>
								</div>
								<div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
									<div class="bg-primary-green h-full rounded-full transition-all duration-300" style="width: {silo1Full}%"></div>
								</div>
							</div>
							<div>
								<div class="flex justify-between text-xs font-semibold mb-1.5">
									<span class="text-slate-700">Silo 2 (Seed)</span>
									<span class="text-slate-400 font-bold">{silo2Full}% Full</span>
								</div>
								<div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
									<div class="bg-emerald-400 h-full rounded-full transition-all duration-300" style="width: {silo2Full}%"></div>
								</div>
							</div>
							<div>
								<div class="flex justify-between text-xs font-semibold mb-1.5">
									<span class="text-slate-700">Cold Storage</span>
									<span class="text-slate-400 font-bold">{coldStorageFull}% Full</span>
								</div>
								<div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
									<div class="bg-amber-400 h-full rounded-full transition-all duration-300" style="width: {coldStorageFull}%"></div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Main Stock table list (8 cols) -->
		<div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col h-full justify-between">
			<div>
				<div class="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/30">
					<div>
						<h3 class="font-extrabold text-slate-800 text-base">Active Stock</h3>
						<p class="text-xs text-slate-400 font-semibold mt-0.5">Filter items by category and manage unit configurations.</p>
					</div>
				</div>

				<!-- Dynamic filter tabs scroll container -->
				<div class="px-5 py-3 border-b border-slate-100 bg-white flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
					{#each ['All', 'Fruits', 'Vegetables', 'Seeds', 'Chemicals', 'Fertilizers', 'Grains', 'Others'] as cat}
						<button 
							onclick={() => filterCategory = cat}
							class={['px-3.5 py-1.5 rounded-full text-[10px] font-bold border transition-all',
								filterCategory === cat 
									? 'bg-primary-green text-white border-primary-green shadow-sm' 
									: 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'].filter(Boolean).join(' ')}
						>
							{cat}
						</button>
					{/each}
				</div>

				<!-- Responsive Table -->
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
								<th class="p-4 pl-6">Product Name</th>
								<th class="p-4">Category</th>
								<th class="p-4 text-right">Stock Level</th>
								<th class="p-4 text-right">Sold/Used</th>
								<th class="p-4 text-right">Available Stock</th>
								<th class="p-4 text-center">Unit</th>
								<th class="p-4 text-center">Remaining Lifespan</th>
								<th class="p-4 pr-6 text-center">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
							{#each filteredItems as item (item.id)}
								{@const statusInfo = determineStatus(item)}
								{@const daysLeft = calculateRemainingLifespan(item.name)}
								<tr class="hover:bg-slate-50/30 transition-colors">
									<td class="p-4 pl-6">
										<span class="font-bold text-slate-800">{item.name}</span>
									</td>
									<td class="p-4 text-slate-400">{item.category}</td>
									<td class="p-4 text-right text-slate-700">{(item.total || 0).toLocaleString()}</td>
									<td class="p-4 text-right text-slate-400">{(item.soldUsed || 0).toLocaleString()}</td>
									<td class="p-4 text-right">
										<span class="font-extrabold text-slate-800">
											{((item.total || 0) - (item.soldUsed || 0)).toLocaleString()}
										</span>
									</td>
									<td class="p-4 text-center">
										<select 
											value={item.unit || 'Kg'} 
											onchange={(e) => changeUnit(item.id, e.target.value)}
											class="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-[10px] font-bold text-slate-650 cursor-pointer focus:outline-none focus:border-primary-green"
										>
											<option value="Kg">Kg</option>
											<option value="Tons">Tons</option>
											<option value="Liters">Liters</option>
										</select>
									</td>
									<td class="p-4 text-center">
										{#if daysLeft !== null}
											<span class={['font-bold flex items-center justify-center gap-1', daysLeft <= 2 ? 'text-red-500 font-extrabold' : 'text-slate-500'].join(' ')}>
												<span class="material-symbols-outlined text-[13px]">schedule</span>
												{daysLeft <= 0 ? 'Expired' : daysLeft + ' Day' + (daysLeft === 1 ? '' : 's')}
											</span>
										{:else}
											<span class="text-slate-300">—</span>
										{/if}
									</td>
									<td class="p-4 pr-6 text-center">
										<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', statusInfo.color].join(' ')}>
											{statusInfo.label}
										</span>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="8" class="p-12 text-center text-slate-400">
										<div class="flex flex-col items-center justify-center gap-2">
											<span class="material-symbols-outlined text-3xl text-slate-350">inventory</span>
											<p class="font-bold text-slate-500">No matching stock items found.</p>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination Info Footer -->
			<div class="p-4 border-t border-slate-100 flex justify-between items-center text-slate-450 bg-slate-50/50 rounded-b-2xl">
				<span>Showing {filteredItems.length} entries</span>
			</div>
		</div>

	</div>
</section>
