<script>
	let {
		value = $bindable(''),
		options = [], // array of { value, label } or simple strings
		label = '',
		required = false,
		disabled = false,
		placeholder = 'Select an option',
		class: customClass = ''
	} = $props();
</script>

<label class={['block space-y-1.5', customClass].join(' ')}>
	{#if label}
		<span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
	{/if}
	<select
		{required}
		{disabled}
		bind:value={value}
		class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e1e]/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:outline-none transition-all duration-200"
	>
		{#if placeholder}
			<option value="" disabled selected={!value}>{placeholder}</option>
		{/if}
		{#each options as opt}
			{@const isObject = typeof opt === 'object' && opt !== null}
			{@const optValue = isObject ? opt.value : opt}
			{@const optLabel = isObject ? opt.label : opt}
			<option value={optValue}>{optLabel}</option>
		{/each}
	</select>
</label>
