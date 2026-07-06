<script>
	let {
		current = $bindable(1),
		total = 0,
		perPage = 10,
		class: customClass = ''
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / perPage)));

	function prev() {
		if (current > 1) current--;
	}

	function next() {
		if (current < totalPages) current++;
	}
</script>

<div class={['flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#1e1e1e] rounded-b-2xl', customClass].join(' ')}>
	<div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
		Showing {total === 0 ? 0 : (current - 1) * perPage + 1} to {Math.min(current * perPage, total)} of {total} entries
	</div>
	<div class="flex gap-2">
		<button
			type="button"
			onclick={prev}
			disabled={current === 1}
			class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-350 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
		>
			Previous
		</button>
		<button
			type="button"
			onclick={next}
			disabled={current === totalPages}
			class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-350 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
		>
			Next
		</button>
	</div>
</div>
