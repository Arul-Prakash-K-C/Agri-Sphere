<script>
	let {
		icon = 'inbox',
		title = 'No Data Found',
		description = 'There are no items to show in this view.',
		class: customClass = '',
		children = null
	} = $props();
</script>

<div class={['text-center py-12 px-4 bg-white dark:bg-[#1e1e1e]/40 rounded-3xl border border-slate-200/50 dark:border-slate-800 flex flex-col items-center justify-center gap-3', customClass].join(' ')}>
	<span class="material-symbols-outlined text-4xl text-slate-350 dark:text-slate-600 block">{icon}</span>
	<h3 class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">{title}</h3>
	<p class="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">{description}</p>
	{#if children}
		<div class="mt-2">
			{@render children()}
		</div>
	{/if}
</div>
