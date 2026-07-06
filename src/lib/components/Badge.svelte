<script>
	let {
		variant = 'primary', // 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
		class: customClass = '',
		children = null
	} = $props();

	const variantClasses = {
		primary: 'bg-emerald-50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30',
		success: 'bg-green-50 text-green-700 border-green-100/50 dark:bg-green-950/20 dark:text-green-450 dark:border-green-900/30',
		warning: 'bg-amber-50 text-amber-800 border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30',
		danger: 'bg-red-50 text-red-755 border-red-100/50 dark:bg-red-950/20 dark:text-red-450 dark:border-red-900/30',
		info: 'bg-blue-50 text-blue-700 border-blue-100/50 dark:bg-blue-950/20 dark:text-blue-450 dark:border-blue-900/30',
		neutral: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800'
	};
</script>

<span
	class={[
		'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border shadow-sm select-none',
		variantClasses[variant] || variantClasses.primary,
		customClass
	].join(' ')}
>
	{#if children}
		{@render children()}
	{/if}
</span>
