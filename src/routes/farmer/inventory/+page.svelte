<script>
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let stockItems = $state([]);
	$effect(() => {
		stockItems = data.inventory || [];
	});

	// Reactive calculation for warning counts
	let warningCount = $derived(stockItems.filter(i => i.status === 'Low' || i.status === 'Warning').length);
	let warningItems = $derived(stockItems.filter(i => i.status === 'Low' || i.status === 'Warning'));

	let filterCategory = $state('All'); // 'All' | 'Seeds' | 'Chemicals' | 'Equipment'
	let filteredItems = $derived.by(() => {
		if (filterCategory === 'All') return stockItems;
		return stockItems.filter(item => item.category === filterCategory);
	});

	// Storage utilization values
	let coldStorageFull = $state(92);
	let silo1Full = $state(85);
	let silo2Full = $state(42);

	let showAddModal = $state(false);

	// Form values for new inventory update
	let updateName = $state('');
	let updateAmount = $state('');
	let updateType = $state('add'); // 'add' | 'remove'

	let loading = $state(false);
	let error = $state('');

	// Set initial dropdown value when items load
	$effect(() => {
		if (stockItems.length > 0 && !updateName) {
			updateName = stockItems[0].name;
		}
	});

	async function handleUpdateStock(event) {
		event.preventDefault();
		const item = stockItems.find(i => i.name === updateName);
		if (!item) return;

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_quantity',
					itemId: item.id,
					amount: Number(updateAmount),
					type: updateType
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to update stock');
			}

			const updatedItem = await res.json();
			stockItems = stockItems.map(i => i.id === updatedItem.id ? updatedItem : i);

			// Reset form & close
			updateAmount = '';
			showAddModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleReplenish() {
		try {
			const res = await fetch('/api/inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'replenish'
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to replenish');
			}

			// Invalidate all to reload the data
			await invalidateAll();
			alert('Low stock items have been replenished successfully!');
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
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory Management</h1>
			<p class="text-sm text-slate-500 mt-1">Manage and monitor all active inventory items.</p>
		</div>
		<div class="flex gap-2">
			<button 
				onclick={handleReplenish}
				class="btn-secondary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
			>
				<span class="material-symbols-outlined text-[18px]">shopping_cart</span>
				<span>Replenish Low Stock</span>
			</button>
			<button 
				onclick={() => showAddModal = true}
				class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-2.5 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap"
			>
				<span class="material-symbols-outlined text-[18px]">update</span>
				<span>Update Stock</span>
			</button>
		</div>
	</div>

	<!-- Update Stock Modal -->
	{#if showAddModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base">Update Stock Quantity</h3>
					<button onclick={() => showAddModal = false} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleUpdateStock} class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
					<label class="block">
						<span class="block mb-1">Select Product</span>
						<select bind:value={updateName} class="input-field w-full text-xs bg-white py-[9.5px]">
							{#each stockItems as item}
								<option value={item.name}>{item.name} ({item.unit})</option>
							{/each}
						</select>
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Action Type</span>
							<select bind:value={updateType} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="add">Add Stock (Purchase)</option>
								<option value="remove">Remove Stock (Use/Sale)</option>
							</select>
						</label>
						<label class="block">
							<span class="block mb-1">Quantity</span>
							<input type="number" min="1" bind:value={updateAmount} required placeholder="Quantity" class="input-field w-full text-xs" />
						</label>
					</div>

					{#if error}
						<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
							⚠️ {error}
						</div>
					{/if}

					<div class="flex gap-3 pt-3 border-t border-slate-100">
						<button 
							type="button" 
							onclick={() => showAddModal = false}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button 
							type="submit" 
							class="btn-primary flex-1 py-3 text-xs"
						>
							Submit Update
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Dashboard Bento Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Low Stock Warnings and Capacity Column (4 cols) -->
		<div class="lg:col-span-4 space-y-6">
			<!-- Critical Warning Card -->
			<div class="glass-card rounded-2xl p-6 border-l-4 border-l-red-500 relative overflow-hidden flex flex-col justify-between">
				<div class="absolute inset-0 bg-gradient-to-br from-red-50/20 to-transparent opacity-60 pointer-events-none"></div>
				<div class="relative z-10 flex justify-between items-start">
					<div class="flex items-center gap-2">
						<div class="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
							<span class="material-symbols-outlined text-[18px]">warning</span>
						</div>
						<h3 class="font-extrabold text-slate-800 text-sm">Critical Warning</h3>
					</div>
					<span class="bg-red-50 text-red-700 border border-red-100/50 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
						{warningCount} Alerts
					</span>
				</div>

				<div class="relative z-10 space-y-3 mt-5">
					{#each warningItems as wItem}
						<div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
							<div>
								<p class="font-bold text-slate-800 text-xs">{wItem.name}</p>
								<p class="text-[10px] text-slate-400 font-semibold mt-0.5">{wItem.category}</p>
							</div>
							<div class="text-right">
								<p class="text-base font-black text-red-500 leading-none">{wItem.progress}%</p>
								<p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Left</p>
							</div>
						</div>
					{:else}
						<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
							<p class="font-bold text-dark-green text-xs">All items are at optimal stock levels!</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Storage capacity widget -->
			<div class="glass-card rounded-2xl p-6 space-y-5 bg-white">
				<h3 class="font-extrabold text-slate-800 text-base flex items-center gap-2">
					<span class="material-symbols-outlined text-primary-green">warehouse</span>
					Storage Utilization
				</h3>
				<div class="space-y-4">
					<div>
						<div class="flex justify-between text-xs font-semibold mb-1">
							<span class="text-slate-700">Silo 1 (Grain)</span>
							<span class="text-slate-400">{silo1Full}% Full</span>
						</div>
						<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
							<div class="bg-primary-green h-full rounded-full" style="width: {silo1Full}%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between text-xs font-semibold mb-1">
							<span class="text-slate-700">Silo 2 (Seed)</span>
							<span class="text-slate-400">{silo2Full}% Full</span>
						</div>
						<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
							<div class="bg-emerald-300 h-full rounded-full" style="width: {silo2Full}%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between text-xs font-semibold mb-1">
							<span class="text-slate-700">Cold Storage</span>
							<span class="text-slate-400">{coldStorageFull}% Full</span>
						</div>
						<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
							<div class="bg-amber-400 h-full rounded-full" style="width: {coldStorageFull}%"></div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Stock table list (8 cols) -->
		<div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col h-full">
			<div class="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/30">
				<div>
					<h3 class="font-extrabold text-slate-800 text-base">Current Stock Levels</h3>
					<p class="text-xs text-slate-400 font-semibold mt-0.5">Filter and manage active stock counts.</p>
				</div>
				<!-- Filter options -->
				<div class="flex gap-2">
					{#each ['All', 'Seeds', 'Chemicals', 'Equipment'] as cat}
						<button 
							onclick={() => filterCategory = cat}
							class={['px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all',
								filterCategory === cat 
									? 'bg-primary-green text-white border-primary-green' 
									: 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'].filter(Boolean).join(' ')}
						>
							{cat}
						</button>
					{/each}
				</div>
			</div>

			<!-- Table list -->
			<div class="overflow-x-auto flex-grow">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
							<th class="p-4 pl-6">Product Name</th>
							<th class="p-4">Category</th>
							<th class="p-4 text-right">Total Stock</th>
							<th class="p-4 text-right">Sold/Used</th>
							<th class="p-4 text-right">Available</th>
							<th class="p-4 pr-6 text-center">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
						{#each filteredItems as item (item.id)}
							<tr class={['transition-colors', item.status === 'Low' ? 'hover:bg-red-50/10' : 'hover:bg-slate-50/30'].filter(Boolean).join(' ')}>
								<td class="p-4 pl-6">
									<div class="flex items-center gap-3">
										<div class={['w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100 shadow-sm', 
											item.status === 'Low' ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'].filter(Boolean).join(' ')}>
											<span class="material-symbols-outlined text-[16px]">{item.icon}</span>
										</div>
										<span class="font-bold text-slate-800">{item.name}</span>
									</div>
								</td>
								<td class="p-4 text-slate-400">{item.category}</td>
								<td class="p-4 text-right text-slate-700">{(item.total || 0).toLocaleString()} {item.unit}</td>
								<td class="p-4 text-right text-slate-400">{(item.soldUsed || 0).toLocaleString()} {item.unit}</td>
								<td class="p-4 text-right">
									<div class="flex flex-col items-end">
										<span class={['font-bold', item.status === 'Low' ? 'text-red-500' : 'text-slate-800'].filter(Boolean).join(' ')}>
											{((item.total || 0) - (item.soldUsed || 0)).toLocaleString()} {item.unit}
										</span>
										<!-- Micro progress bar -->
										<div class="w-16 bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
											<div 
												class={['h-full rounded-full', item.status === 'Low' ? 'bg-red-500' : item.status === 'Warning' ? 'bg-amber-400' : 'bg-primary-green'].filter(Boolean).join(' ')} 
												style="width: {item.progress}%"
											></div>
										</div>
									</div>
								</td>
								<td class="p-4 pr-6 text-center">
									<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', item.statusColor].filter(Boolean).join(' ')}>
										{item.status}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div class="p-4 border-t border-slate-100 flex justify-between items-center text-slate-400 bg-slate-50/50 rounded-b-2xl">
				<span>Showing {filteredItems.length} entries</span>
				<div class="flex gap-1.5">
					<button class="p-1 rounded hover:bg-slate-200 disabled:opacity-50" disabled>
						<span class="material-symbols-outlined text-base">chevron_left</span>
					</button>
					<button class="w-7 h-7 rounded bg-primary-green text-white font-bold flex items-center justify-center">1</button>
					<button class="p-1 rounded hover:bg-slate-200 disabled:opacity-50" disabled>
						<span class="material-symbols-outlined text-base">chevron_right</span>
					</button>
				</div>
			</div>
		</div>

	</div>
</section>
