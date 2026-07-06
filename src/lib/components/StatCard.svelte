<script>
	let {
		title = '',
		value = '',
		icon = '',
		change = null, // e.g. { value: 12, trend: 'up' } or '+12%'
		changeLabel = '',
		class: customClass = ''
	} = $props();

	const isTrendUp = $derived(change && (change.trend === 'up' || String(change.value || change).includes('+')));
	const isTrendDown = $derived(change && (change.trend === 'down' || String(change.value || change).includes('-')));
</script>

<div class={['glass-card p-6 rounded-2xl flex flex-col justify-between h-36 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group', customClass].join(' ')}>
	<div class="absolute -right-4 -top-4 w-24 h-24 bg-primary-green/5 rounded-full blur-xl group-hover:bg-primary-green/10 transition-colors"></div>
	
	<div class="flex justify-between items-start z-10">
		{#if icon}
			<div class="bg-emerald-50 dark:bg-emerald-950/40 text-primary-green p-2.5 rounded-2xl flex items-center justify-center">
				<span class="material-symbols-outlined text-2xl">{icon}</span>
			</div>
		{/if}
		
		{#if change}
			<span
				class={[
					'px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-0.5 border shadow-sm',
					isTrendUp 
						? 'bg-emerald-50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' 
						: isTrendDown
						? 'bg-red-50 text-red-600 border-red-100/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40'
						: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800'
				].join(' ')}
			>
				<span class="material-symbols-outlined text-[12px] font-bold">
					{isTrendUp ? 'trending_up' : isTrendDown ? 'trending_down' : 'trending_flat'}
				</span>
				<span>{change.value || change}</span>
			</span>
		{/if}
	</div>

	<div class="space-y-1 z-10">
		<p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
		<h3 class="text-2xl font-black text-slate-800 dark:text-white leading-none flex items-baseline gap-1.5">
			<span>{value}</span>
			{#if changeLabel}
				<span class="text-[9px] font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal">{changeLabel}</span>
			{/if}
		</h3>
	</div>
</div>
