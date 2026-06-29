<script>
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Reactive bindings from load data
	let stockItems = $state([]);
	let crops = $state([]);
	let harvests = $state([]);

	// Storages & Modal State
	let storages = $state([]);
	let showStorageModal = $state(false);
	let storageFormMode = $state('add'); // 'add' | 'edit'
	let editingStorage = $state(null);

	// Storage Details Modal
	let showStorageDetailsModal = $state(false);
	let selectedStorageForDetails = $state(null);
	let itemsInSelectedStorage = $derived(
		selectedStorageForDetails ? stockItems.filter(item => item.storageId === selectedStorageForDetails.id) : []
	);

	function openStorageDetails(storage) {
		selectedStorageForDetails = storage;
		showStorageDetailsModal = true;
	}
	function closeStorageDetails() {
		showStorageDetailsModal = false;
		selectedStorageForDetails = null;
	}

	// Storage Form Fields
	let storageName = $state('');
	let storageCapacity = $state('');
	let storageUnit = $state('kg');
	let storageCategories = $state([]);

	$effect(() => {
		stockItems = data.inventory || [];
		crops = data.crops || [];
		harvests = data.harvests || [];
		storages = data.storages || [];
	});

	let filterCategory = $state('All'); // 'All' | 'Fruits' | 'Vegetables' | 'Seeds' | 'Chemicals' | 'Fertilizers' | 'Grains' | 'Others'
	let loading = $state(false);
	let error = $state('');

	// Helper to find harvest details or crop details for dynamic lifespan calculation
	function getLifespanDetails(itemName) {
		if (!itemName || typeof itemName !== 'string') {
			return null;
		}
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
	function calculateRemainingLifespan(item) {
		if (item && typeof item === 'object' && item.expiryDate) {
			const expiry = new Date(item.expiryDate + 'T00:00:00');
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const diffMs = expiry.getTime() - today.getTime();
			return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		}

		const itemName = item && typeof item === 'object' ? item.name : item;
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

	// Status calculation logic removed

	function getItemDetails(item) {
		const harvest = harvests.find(h => h.id === item.sourceId) || (item.harvestIds && item.harvestIds.length > 0 ? harvests.find(h => item.harvestIds.includes(h.id)) : null);
		const category = (item.category || '').trim();
		const productName = harvest ? harvest.cropName.trim() : (item.name || '').replace(/\s+Harvest$/i, '').trim();
		const grade = item.grade ? item.grade.trim() : (harvest ? (harvest.qualityGrade || '').trim() : '');
		const lifespan = item.lifespan ? item.lifespan.trim() : (harvest ? (harvest.lifespan || '').trim() : '');
		return { category, productName, grade, lifespan };
	}

	let aggregatedItems = $derived.by(() => {
    // Aggregation removed: show individual stock items directly.
    // This placeholder maintains variable for backward compatibility if referenced elsewhere.
    return stockItems;
});

	// Dynamic categorisation filter match
	let filteredItems = $derived.by(() => {
    const activeItems = stockItems.filter(item => ((item.total || 0) - (item.soldUsed || 0)) > 0);
    if (filterCategory === 'All') return activeItems;
    return activeItems.filter(item => {
        const cat = item.category ? item.category.trim().toLowerCase() : '';
        const filter = filterCategory.trim().toLowerCase();
        // Map seeds category
        if (filter === 'seeds' && (cat === 'seeds' || cat === 'seed')) return true;
        if (filter === 'fertilizers' && (cat === 'fertilizers' || cat === 'fertilizer')) return true;
        return cat === filter;
    });
});

	function convertToUnit(amount, fromUnit, toUnit) {
		if (!amount || isNaN(amount)) return 0;
		const from = (fromUnit || '').trim().toLowerCase();
		const to = (toUnit || '').trim().toLowerCase();
		if (from === to) return amount;
		
		if (from === 'kg' && to === 'tons') return amount / 1000;
		if (from === 'tons' && to === 'kg') return amount * 1000;
		if (from === 'g' && to === 'kg') return amount / 1000;
		if (from === 'kg' && to === 'g') return amount * 1000;
		if (from === 'ml' && to === 'liters') return amount / 1000;
		if (from === 'liters' && to === 'ml') return amount * 1000;

		return amount;
	}

	function openAddStorage() {
		storageFormMode = 'add';
		editingStorage = null;
		storageName = '';
		storageCapacity = '';
		storageUnit = 'kg';
		storageCategories = [];
		showStorageModal = true;
		error = '';
	}

	function openEditStorage(storage) {
		storageFormMode = 'edit';
		editingStorage = storage;
		storageName = storage.name || '';
		storageCapacity = String(storage.capacity || '');
		storageUnit = storage.unit || 'kg';
		storageCategories = [...(storage.categories || [])];
		showStorageModal = true;
		error = '';
	}

	function closeStorageModal() {
		showStorageModal = false;
		editingStorage = null;
	}

	function toggleCategory(cat) {
		if (storageCategories.includes(cat)) {
			storageCategories = storageCategories.filter(c => c !== cat);
		} else {
			storageCategories = [...storageCategories, cat];
		}
	}

	async function handleSaveStorage(event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			if (storageFormMode === 'add') {
				const res = await fetch('/api/storages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: storageName,
						capacity: Number(storageCapacity),
						unit: storageUnit,
						categories: storageCategories
					})
				});

				if (!res.ok) {
					const d = await res.json();
					throw new Error(d.error || 'Failed to add storage');
				}

				const added = await res.json();
				storages = [...storages, added];
				closeStorageModal();
			} else {
				const res = await fetch(`/api/storages/${editingStorage.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: storageName,
						capacity: Number(storageCapacity),
						unit: storageUnit,
						categories: storageCategories
					})
				});

				if (!res.ok) {
					const d = await res.json();
					throw new Error(d.error || 'Failed to update storage');
				}

				const updated = await res.json();
				storages = storages.map(s => s.id === updated.id ? updated : s);
				closeStorageModal();
			}
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteStorage(id) {
		if (!confirm('Are you sure you want to delete this storage? Linked inventory items will no longer be tracked under this storage.')) return;
		loading = true;
		error = '';

		try {
			const res = await fetch(`/api/storages/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to delete storage');
			}

			storages = storages.filter(s => s.id !== id);
		} catch (err) {
			alert(err.message);
		} finally {
			loading = false;
		}
	}

	// Inline table write operations removed
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
						<button 
							onclick={openAddStorage} 
							class="text-xs font-bold text-primary-green hover:underline flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-sm">add</span> Add Storage
						</button>
					</div>

					<div class="space-y-3">
						{#each storages as storage (storage.id)}
							{@const occupied = stockItems.filter(item => item.storageId === storage.id).reduce((sum, item) => sum + convertToUnit(((item.total || 0) - (item.soldUsed || 0)), item.unit, storage.unit), 0)}
							{@const occupiedDisplay = Math.round(occupied * 1000) / 1000}
							{@const pct = storage.capacity > 0 ? Math.min(100, (occupied / storage.capacity) * 100) : 0}
							{@const pctDisplay = Math.round(pct * 10) / 10}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div 
								class="group/storage border border-slate-100 rounded-xl p-4 bg-white hover:border-primary-green/30 hover:shadow-sm hover:shadow-primary-green/5 cursor-pointer transition-all"
								onclick={() => openStorageDetails(storage)}
							>
								<div class="flex justify-between items-start mb-2 gap-2">
									<div class="flex-grow min-w-0">
										<div class="font-bold text-sm text-slate-800 flex items-center gap-1.5 flex-wrap">
											<span class="truncate transition-colors group-hover/storage:text-primary-green">{storage.name}</span>
											<span class="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full capitalize">
												{storage.categories.join(', ')}
											</span>
										</div>
										<p class="text-[10px] text-slate-400 mt-1 font-semibold">
											{occupiedDisplay} / {storage.capacity} {storage.unit} occupied
										</p>
									</div>
									<div class="flex items-center gap-1.5 shrink-0">
										<span class="text-xs font-black {pct > 90 ? 'text-red-500' : pct > 75 ? 'text-amber-500' : 'text-slate-600'}">{pctDisplay}% Full</span>
										<button
											onclick={(e) => { e.stopPropagation(); openEditStorage(storage); }}
											class="text-slate-300 hover:text-primary-green transition-colors p-1"
											title="Edit storage"
										>
											<span class="material-symbols-outlined text-[16px]">edit</span>
										</button>
										<button
											onclick={(e) => { e.stopPropagation(); handleDeleteStorage(storage.id); }}
											class="text-slate-300 hover:text-red-500 transition-colors p-1"
											title="Delete storage"
										>
											<span class="material-symbols-outlined text-[16px]">delete</span>
										</button>
									</div>
								</div>
								<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-1">
									<div 
										class={['h-full rounded-full transition-all duration-300', 
											pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-primary-green'
										].join(' ')} 
										style="width: {pct}%"
									></div>
								</div>
							</div>
						{:else}
							<div class="text-xs text-slate-400 text-center py-6 font-semibold">No storage locations configured.</div>
						{/each}
					</div>
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
					<table class="w-full text-left border-collapse text-xs table-fixed min-w-[760px]">
						<thead>
							<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[9px] text-slate-400 border-b border-slate-100">
								<th class="p-4 pl-6 w-[20%]">Product Name</th>
								<th class="p-4 w-[12%]">Category</th>
								<th class="p-4 text-center w-[12%]">Stock Level</th>
								<th class="p-4 text-center w-[12%]">Sold/Used</th>
								<th class="p-4 text-center w-[15%]">Available Stock</th>
								<th class="p-4 text-center w-[12%]">Unit</th>
								<th class="p-4 pr-6 text-center w-[17%]">Remaining Lifespan</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
							{#each filteredItems as item (item.id)}
								{@const daysLeft = calculateRemainingLifespan(item)}
								<tr class="hover:bg-slate-50/30 transition-colors">
									<td class="p-4 pl-6">
										<span class="font-bold text-slate-800 break-words line-clamp-2 block leading-snug">{item.name}</span>
									</td>
									<td class="p-4 text-slate-400 capitalize">{item.category}</td>
									<td class="p-4 text-center">
										<span class="font-bold text-slate-600">{item.total || 0}</span>
									</td>
									<td class="p-4 text-center">
										<span class="font-bold text-slate-600">{item.soldUsed || 0}</span>
									</td>
									<td class="p-4 text-center">
										<span class="font-black text-slate-800">
											{((item.total || 0) - (item.soldUsed || 0)).toLocaleString()}
										</span>
									</td>
									<td class="p-4 text-center">
										<span class="font-bold text-slate-600">{item.unit || 'Kg'}</span>
									</td>
									<td class="p-4 pr-6 text-center">
										{#if daysLeft !== null}
											<span class={['font-bold flex items-center justify-center gap-1', daysLeft <= 2 ? 'text-red-500 font-extrabold' : 'text-slate-500'].join(' ')}>
												<span class="material-symbols-outlined text-[13px]">schedule</span>
												{daysLeft <= 0 ? 'Expired' : daysLeft + ' Day' + (daysLeft === 1 ? '' : 's')}
											</span>
										{:else}
											<span class="text-slate-300">—</span>
										{/if}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="7" class="p-12 text-center text-slate-400">
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

	{#if showStorageModal}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 bg-slate-950/35 backdrop-blur-xs flex items-center justify-center z-50 p-4"
		>
			<div
				transition:slide={{ duration: 200 }}
				class="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
			>
				<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
					<h3 class="font-extrabold text-slate-800 text-sm">
						{storageFormMode === 'add' ? 'Add Storage Location' : 'Edit Storage Location'}
					</h3>
					<button
						onclick={closeStorageModal}
						class="text-slate-400 hover:text-slate-600 transition-colors size-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
					>
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>

				<form onsubmit={handleSaveStorage} class="p-6 space-y-4 text-xs font-semibold text-slate-700">
					<div>
						<label for="storage-name" class="block mb-1.5 font-bold">Storage Name <span class="text-red-500">*</span></label>
						<input
							id="storage-name"
							type="text"
							bind:value={storageName}
							required
							placeholder="e.g. Silo 3 (Grains), Cold Storage Room A"
							class="input-field w-full text-xs"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="storage-capacity" class="block mb-1.5 font-bold">Capacity <span class="text-red-500">*</span></label>
							<input
								id="storage-capacity"
								type="number"
								min="1"
								bind:value={storageCapacity}
								required
								placeholder="e.g. 1000"
								class="input-field w-full text-xs"
							/>
						</div>
						<div>
							<label for="storage-unit" class="block mb-1.5 font-bold">Unit <span class="text-red-500">*</span></label>
							<select
								id="storage-unit"
								bind:value={storageUnit}
								required
								class="input-field w-full text-xs bg-white py-[9.5px]"
							>
								<option value="kg">kg</option>
								<option value="Tons">Tons</option>
								<option value="Liters">Liters</option>
								<option value="Bags">Bags</option>
								<option value="Units">Units</option>
							</select>
						</div>
					</div>

					<div>
						<span class="block mb-2 font-bold text-slate-700">Allowed Categories <span class="text-red-500">*</span></span>
						<div class="grid grid-cols-2 gap-2 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
							{#each ['Vegetables', 'Fruits', 'Seeds', 'Fertilizers', 'Chemicals', 'Grains', 'Others'] as cat}
								<label class="flex items-center gap-2 cursor-pointer font-bold text-slate-600">
									<input
										type="checkbox"
										checked={storageCategories.includes(cat)}
										onchange={() => toggleCategory(cat)}
										class="rounded text-primary-green focus:ring-primary-green"
									/>
									{cat}
								</label>
							{/each}
						</div>
						{#if storageCategories.length === 0}
							<p class="text-[10px] text-red-500 mt-1">⚠️ At least one category must be selected.</p>
						{/if}
					</div>

					{#if error}
						<div class="text-red-500 text-xs">{error}</div>
					{/if}

					<div class="flex gap-3 pt-3 border-t border-slate-100">
						<button
							type="button"
							onclick={closeStorageModal}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading || storageCategories.length === 0}
							class="btn-primary flex-1 py-3 text-xs"
						>
							{loading ? 'Saving...' : 'Save Storage'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if showStorageDetailsModal}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 bg-slate-950/35 backdrop-blur-xs flex items-center justify-center z-50 p-4"
		>
			<div
				transition:slide={{ duration: 200 }}
				class="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
			>
				<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
					<div>
						<h3 class="font-extrabold text-slate-800 text-base">
							{selectedStorageForDetails?.name} Contents
						</h3>
						<p class="text-[10px] text-slate-500 font-semibold mt-0.5">
							{selectedStorageForDetails?.capacity} {selectedStorageForDetails?.unit} Capacity • {selectedStorageForDetails?.categories.join(', ')}
						</p>
					</div>
					<button
						onclick={closeStorageDetails}
						class="text-slate-400 hover:text-slate-600 transition-colors size-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
					>
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				
				<div class="p-6 overflow-y-auto">
					{#if itemsInSelectedStorage.length > 0}
						<div class="border border-slate-100 rounded-xl overflow-hidden">
							<table class="w-full text-left border-collapse text-xs table-fixed">
								<thead>
									<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[9px] text-slate-400 border-b border-slate-100">
										<th class="p-3 pl-4 w-[40%]">Item Name</th>
										<th class="p-3 w-[20%]">Category</th>
										<th class="p-3 text-center w-[20%]">Available</th>
										<th class="p-3 text-center w-[20%]">Unit</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
									{#each itemsInSelectedStorage as item (item.id)}
										<tr class="hover:bg-slate-50/30">
											<td class="p-3 pl-4 font-bold text-slate-800 truncate">{item.name}</td>
											<td class="p-3 text-slate-400 capitalize truncate">{item.category}</td>
											<td class="p-3 text-center font-black text-slate-800">{((item.total || 0) - (item.soldUsed || 0)).toLocaleString()}</td>
											<td class="p-3 text-center font-bold text-slate-600">{item.unit || 'Kg'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-10 gap-2">
							<span class="material-symbols-outlined text-3xl text-slate-300">inventory_2</span>
							<p class="font-bold text-slate-500 text-sm">Storage is currently empty.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>
