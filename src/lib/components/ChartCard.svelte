<script>
	let {
		title = '',
		class: customClass = '',
		actions = null,
		children = null
	} = $props();
</script>

<div class={['bg-white dark:bg-[#1e1e1e] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between h-96 shadow-sm', customClass].join(' ')}>
	<div class="flex justify-between items-center mb-4 flex-shrink-0">
		<h3 class="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{title}</h3>
		{#if actions}
			<div class="flex gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
	<div class="flex-grow min-h-0 relative w-full h-full">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
