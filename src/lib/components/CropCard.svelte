<script>
	import Card from './Card.svelte';
	import { getHarvestStatus } from '../utils/formatting.js';

	let {
		crop = {},
		onDelete = null
	} = $props();
</script>

<Card 
	imageUrl={crop.imageUrl} 
	title={crop.name} 
	subtitle={crop.location}
>
	{#snippet actions()}
		{#if onDelete}
			<button
				onclick={() => onDelete(crop.id)}
				class="bg-white/80 backdrop-blur-sm text-red-650 p-1.5 rounded-full hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm cursor-pointer"
			>
				<span class="material-symbols-outlined text-[18px]">delete</span>
			</button>
		{/if}
	{/snippet}

	<div class="flex justify-between items-center text-xs">
		<span
			class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100/50 bg-emerald-50 text-dark-green dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 flex items-center gap-1.5"
			title={crop.harvestDuration}
		>
			<span class="w-1.5 h-1.5 rounded-full bg-primary-green"></span>
			{getHarvestStatus(crop.plantedDate, crop.harvestDuration)}
		</span>
		<span class="text-slate-400 font-semibold flex items-center gap-1">
			<span class="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
			Planted: {crop.plantedDate}
		</span>
	</div>

	<div class="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
		<div class="size-10 rounded-xl bg-primary-green/10 flex items-center justify-center text-primary-green shrink-0">
			<span class="material-symbols-outlined text-lg">potted_plant</span>
		</div>
		<div class="flex-1">
			<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acreage</p>
			<div class="flex justify-between items-end mt-1">
				<span class="text-xl font-black text-slate-800 dark:text-white leading-none">{crop.acres}</span>
				<span class="text-[10px] font-bold text-slate-400 uppercase">Acres</span>
			</div>
		</div>
	</div>
</Card>
