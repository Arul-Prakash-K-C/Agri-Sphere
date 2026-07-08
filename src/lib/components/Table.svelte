<script>
	let {
		headers = [],
		children = null,
		class: customClass = ''
	} = $props();
</script>

<div class={['overflow-x-auto w-full border border-slate-200/50 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#1e1e1e] shadow-sm', customClass].join(' ')}>
	<table class="w-full text-left border-collapse text-xs">
		<thead>
			<tr class="bg-slate-50 dark:bg-slate-900/60 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
				{#each headers as header}
					<th class="p-4">{header}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if children}
				{@render children()}
			{/if}
		</tbody>
	</table>
</div>
