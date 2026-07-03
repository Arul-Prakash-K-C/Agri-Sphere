<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { showAlert } from '$lib/modal.svelte.js';

	let { data } = $props();

	// Product Comparison State
	let compareList = $state([]);

	onMount(() => {
		if (browser) {
			try {
				const saved = localStorage.getItem('cust_compare_list');
				if (saved) compareList = JSON.parse(saved);
			} catch (e) {
				console.error('Error reading compare list:', e);
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

	function clearComparison() {
		compareList = [];
	}

	// Derived state to determine the "Best Choice" product during comparison
	// Evaluates: (1) Lowest price (2) Best Quality Grade (3) Maximum available stock
	let bestProductId = $derived.by(() => {
		if (compareList.length < 2) return null;
		
		let best = compareList[0];
		for (let i = 1; i < compareList.length; i++) {
			const current = compareList[i];
			
			// 1. Price comparison (lower is better)
			const priceBest = Number(String(best.price).replace(/[^0-9]/g, ''));
			const priceCurrent = Number(String(current.price).replace(/[^0-9]/g, ''));
			
			if (priceCurrent < priceBest) {
				best = current;
				continue;
			} else if (priceCurrent > priceBest) {
				continue;
			}
			
			// 2. Quality grade comparison (Grade A / Premium / Mixed)
			const gradeWeight = (grade) => {
				const g = String(grade || '').toLowerCase();
				if (g.includes('premium') || g.includes('a')) return 3;
				if (g.includes('mixed')) return 2;
				return 1; // standard / lower
			};
			
			const gradeBest = gradeWeight(best.qualityGrade);
			const gradeCurrent = gradeWeight(current.qualityGrade);
			
			if (gradeCurrent > gradeBest) {
				best = current;
				continue;
			} else if (gradeCurrent < gradeBest) {
				continue;
			}
			
			// 3. Stock volume comparison (higher availability is safer/better)
			const stockBest = Number(best.quantity || 0);
			const stockCurrent = Number(current.quantity || 0);
			if (stockCurrent > stockBest) {
				best = current;
			}
		}
		return best.id;
	});
</script>

<svelte:head>
	<title>Compare Products - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6 text-slate-800 bg-[#F8FAF5] min-h-[85vh] p-1 rounded-3xl">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2 border-b border-emerald-100 pb-5">
		<div>
			<h1 class="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">⚖️</span> Compare Products
			</h1>
			<p class="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed max-w-xl">
				Compare up to 3 produce items side-by-side to choose the best listing.
			</p>
		</div>
		{#if compareList.length > 0}
			<div>
				<button 
					onclick={clearComparison}
					class="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-200"
				>
					<span class="material-symbols-outlined text-[15px]">delete</span> Clear Compare List
				</button>
			</div>
		{/if}
	</div>

	<!-- Product Comparison Grid table layout -->
	<div class="space-y-4 animate-fade-in">
		{#if compareList.length > 0}
			<div class="bg-white border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
								<th class="p-4 pl-6 w-48">Spec/Feature</th>
								{#each compareList as p}
									<th class="p-4 relative">
										{#if bestProductId === p.id}
											<div class="absolute -top-1 left-4 bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-b-md shadow-sm tracking-widest animate-pulse z-20">
												⭐ Best Choice
											</div>
										{/if}
										<button 
											onclick={(e) => toggleComparison(p, e)}
											class="absolute top-2 right-2 text-slate-400 hover:text-red-500 size-6 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer"
											title="Remove item"
										>
											<span class="material-symbols-outlined text-[14px]">close</span>
										</button>
										<div class="flex items-center gap-3 mt-2 pr-6">
											<img src={p.imageUrl} alt={p.name} class="size-12 rounded-lg object-cover" />
											<div>
												<p class="font-black text-slate-800 truncate text-xs">{p.name}</p>
												<p class="text-[9px] text-slate-400 font-bold mt-0.5">{p.category}</p>
											</div>
										</div>
									</th>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<th class="p-4 text-slate-350 italic font-medium text-[10px]">Empty Slot</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50 text-slate-650 font-medium">
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Farmer</td>
								{#each compareList as p}
									<td class="p-4 text-slate-800 font-bold">{p.farmerName || p.farmer || 'Verified Farmer'}</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Price</td>
								{#each compareList as p}
									<td class="p-4 text-primary-green font-black text-sm">₹{p.price} <span class="text-[10px] text-slate-400 font-normal">/ {p.unit || 'KG'}</span></td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Available Quantity</td>
								{#each compareList as p}
									<td class="p-4 text-slate-800 font-bold">{p.quantity} {p.unit || 'KG'}</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Unit</td>
								{#each compareList as p}
									<td class="p-4 text-slate-600">{p.unit || 'KG'}</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Quality Grade</td>
								{#each compareList as p}
									<td class="p-4">
										<span class="bg-[#F8FAF5] border border-emerald-100 text-dark-green text-[10px] font-bold px-2 py-0.5 rounded">
											{p.qualityGrade || 'Grade A'}
										</span>
									</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Harvest Date</td>
								{#each compareList as p}
									<td class="p-4 text-slate-500 font-semibold">{p.harvestDate || 'Recently Harvested'}</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
							<tr class="hover:bg-slate-50/20">
								<td class="p-4 pl-6 text-slate-400 uppercase text-[10px] font-bold">Availability</td>
								{#each compareList as p}
									<td class="p-4">
										<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-dark-green border-emerald-100">
											{p.status || 'Available'}
										</span>
									</td>
								{/each}
								{#each Array.from({ length: Math.max(0, 3 - compareList.length) }) as _}
									<td class="p-4 text-slate-300">—</td>
								{/each}
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="bg-white p-16 rounded-2xl text-center text-slate-400 border border-slate-200/50">
				<span class="material-symbols-outlined text-4xl text-slate-350 block mb-2">compare_arrows</span>
				<p class="font-bold text-slate-500">Comparison list is empty.</p>
				<p class="text-xs text-slate-400 mt-1">Select items in the browse produce grid to add them to comparison view.</p>
				<a href="/customer/dashboard" class="mt-3 btn-primary text-xs px-4 py-2 cursor-pointer inline-block">Browse Produce</a>
			</div>
		{/if}
	</div>
</section>
