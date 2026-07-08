<script>
	let {
		status = '', // 'Available', 'sold', 'active', 'pending', etc.
		class: customClass = ''
	} = $props();

	const statusMap = $derived.by(() => {
		const st = (status || '').toLowerCase().trim();
		if (st === 'available' || st === 'good' || st === 'active' || st === 'verified') {
			return {
				label: status,
				class: 'bg-emerald-50 text-dark-green border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
			};
		}
		if (st === 'sold' || st === 'expired' || st === 'rejected') {
			return {
				label: status,
				class: 'bg-red-50 text-red-650 border-red-100/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40'
			};
		}
		if (st === 'pending' || st === 'low stock' || st === 'warning') {
			return {
				label: status,
				class: 'bg-amber-50 text-amber-805 border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
			};
		}
		// Default fallback
		return {
			label: status || 'Unknown',
			class: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800'
		};
	});
</script>

<span
	class={[
		'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border capitalize shadow-sm select-none',
		statusMap.class,
		customClass
	].join(' ')}
>
	<span class="size-1.5 rounded-full bg-current shrink-0"></span>
	<span>{statusMap.label}</span>
</span>
