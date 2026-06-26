<script>
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	let harvests = $state([]);
	$effect(() => {
		harvests = data.harvests || [];
	});

	let showAddModal = $state(false);

	// Form values
	let newCropName = $state('');
	let newQuantity = $state('');
	let newUnit = $state('Quintals');
	let newHarvestDate = $state(new Date().toISOString().split('T')[0]);
	let newQualityGrade = $state('Grade A');
	let newNotes = $state('');

	let loading = $state(false);
	let error = $state('');

	async function handleAddHarvest(event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/harvests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cropName: newCropName,
					quantity: Number(newQuantity),
					unit: newUnit,
					harvestDate: newHarvestDate,
					qualityGrade: newQualityGrade,
					notes: newNotes
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to log harvest');
			}

			const added = await res.json();
			harvests = [added, ...harvests];

			// Reset form
			newCropName = '';
			newQuantity = '';
			newNotes = '';
			showAddModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Harvest Logs - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Harvest Logs</h1>
			<p class="text-sm text-slate-500 mt-1">Record and track your farm yields and product quality.</p>
		</div>
		<button 
			onclick={() => showAddModal = true}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap"
		>
			<span class="material-symbols-outlined text-[18px]">add_circle</span>
			<span>Log New Harvest</span>
		</button>
	</div>

	<!-- Add Harvest Modal -->
	{#if showAddModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base">New Harvest Log</h3>
					<button onclick={() => showAddModal = false} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleAddHarvest} class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
					<label class="block">
						<span class="block mb-1">Crop Name</span>
						<input type="text" bind:value={newCropName} required placeholder="e.g. Basmati Rice" class="input-field w-full text-xs" />
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Quantity</span>
							<input type="number" bind:value={newQuantity} required placeholder="e.g. 50" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Unit</span>
							<select bind:value={newUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Quintals">Quintals</option>
								<option value="Tons">Tons</option>
								<option value="kg">kg</option>
							</select>
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Harvest Date</span>
							<input type="date" bind:value={newHarvestDate} required class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Quality Grade</span>
							<select bind:value={newQualityGrade} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Grade A+">Grade A+</option>
								<option value="Grade A">Grade A</option>
								<option value="Grade B">Grade B</option>
								<option value="Grade C">Grade C</option>
							</select>
						</label>
					</div>

					<label class="block">
						<span class="block mb-1">Notes</span>
						<textarea bind:value={newNotes} rows="3" placeholder="Additional details..." class="input-field w-full text-xs"></textarea>
					</label>

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
							disabled={loading}
							class="btn-primary flex-1 py-3 text-xs"
						>
							{loading ? 'Logging...' : 'Submit Log'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Harvest Listings Table -->
	<div class="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
		<div class="p-5 border-b border-slate-100 flex justify-between items-center">
			<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Harvest Register</h3>
			<span class="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-0.5">{harvests.length} logs</span>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6">Crop Name</th>
						<th class="p-4">Harvest Date</th>
						<th class="p-4">Quantity</th>
						<th class="p-4">Quality Grade</th>
						<th class="p-4 pr-6">Notes</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#if loading}
						{#each Array(2) as _}
							<tr class="animate-pulse border-b border-slate-50">
								<td class="p-4 pl-6"><div class="skeleton h-4 w-28 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4 pr-6"><div class="skeleton h-4 w-32 rounded"></div></td>
							</tr>
						{/each}
					{/if}
					{#each harvests as harvest (harvest.id)}
						<tr class="hover:bg-slate-50/30 transition-colors">
							<td class="p-4 pl-6 font-bold text-slate-800">{harvest.cropName}</td>
							<td class="p-4 text-slate-400">{harvest.harvestDate}</td>
							<td class="p-4 font-extrabold text-slate-800">{harvest.quantity} {harvest.unit}</td>
							<td class="p-4">
								<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-dark-green border-emerald-100/50">
									{harvest.qualityGrade}
								</span>
							</td>
							<td class="p-4 pr-6 text-slate-500">{harvest.notes || 'N/A'}</td>
						</tr>
					{:else}
						<tr>
							<td class="p-6 text-center text-slate-400" colspan="5">No harvests logged yet.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
