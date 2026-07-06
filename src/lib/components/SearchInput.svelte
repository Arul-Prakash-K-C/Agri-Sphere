<script>
	let {
		value = $bindable(''),
		placeholder = 'Search...',
		class: customClass = ''
	} = $props();

	function clear() {
		value = '';
	}
</script>

<div class={['relative w-full', customClass].join(' ')}>
	<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">search</span>
	<input
		type="text"
		{placeholder}
		bind:value={value}
		class="w-full h-11 pl-11 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e1e]/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:outline-none transition-all duration-200"
	/>
	{#if value}
		<button
			type="button"
			onclick={clear}
			class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full flex items-center justify-center cursor-pointer"
		>
			<span class="material-symbols-outlined text-[18px]">close</span>
		</button>
	{/if}
</div>
