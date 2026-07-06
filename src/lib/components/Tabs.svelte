<script>
	let {
		selected = $bindable(''),
		tabs = [], // Array of { id, label, icon } or simple strings
		class: customClass = ''
	} = $props();
</script>

<div class={['flex border-b border-emerald-100/50 dark:border-slate-800/80 gap-4 overflow-x-auto no-scrollbar', customClass].join(' ')}>
	{#each tabs as tab}
		{@const isObject = typeof tab === 'object' && tab !== null}
		{@const tabId = isObject ? tab.id : tab}
		{@const tabLabel = isObject ? tab.label : tab}
		{@const tabIcon = isObject ? tab.icon : ''}
		{@const isActive = selected === tabId}
		
		<button
			type="button"
			onclick={() => selected = tabId}
			class={[
				'pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap px-1 outline-none',
				isActive
					? 'border-emerald-600 text-emerald-600 font-black'
					: 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
			].join(' ')}
		>
			{#if tabIcon}
				<span class="material-symbols-outlined text-[16px]">{tabIcon}</span>
			{/if}
			<span>{tabLabel}</span>
		</button>
	{/each}
</div>
