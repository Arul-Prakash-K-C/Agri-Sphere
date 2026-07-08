<script>
	let {
		selected = $bindable(''),
		options = [], // Array of { id, label } or simple strings
		class: customClass = ''
	} = $props();
</script>

<div class={['flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0', customClass].join(' ')}>
	{#each options as opt}
		{@const isObject = typeof opt === 'object' && opt !== null}
		{@const optId = isObject ? opt.id : opt}
		{@const optLabel = isObject ? opt.label : opt}
		{@const isActive = selected === optId}
		<button
			type="button"
			onclick={() => selected = optId}
			class={[
				'px-4 py-2 text-xs font-extrabold rounded-full shrink-0 border transition-all duration-200 cursor-pointer active:scale-95',
				isActive
					? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
					: 'bg-white hover:bg-slate-55 border-slate-200 text-slate-650 hover:text-slate-900 dark:bg-[#1e1e1e]/90 dark:border-slate-800 dark:text-slate-350 dark:hover:text-slate-100'
			].join(' ')}
		>
			{optLabel}
		</button>
	{/each}
</div>
