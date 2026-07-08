<script>
	let {
		size = 'md', // 'sm' | 'md' | 'lg'
		overlay = false, // Full screen backdrop loader
		class: customClass = ''
	} = $props();

	const sizeClasses = {
		sm: 'text-lg',
		md: 'text-2xl',
		lg: 'text-4xl'
	};
</script>

{#if overlay}
	<div class="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-200 flex items-center justify-center">
		<div class="bg-white dark:bg-[#1e1e1e] p-5 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-2xl flex flex-col items-center gap-3">
			<span class="material-symbols-outlined text-3xl text-emerald-600 animate-spin">progress_activity</span>
			<span class="text-xs font-bold text-slate-500 dark:text-slate-400">Loading...</span>
		</div>
	</div>
{:else}
	<div class={['flex items-center justify-center p-4', customClass].join(' ')}>
		<span class={['material-symbols-outlined text-emerald-600 animate-spin', sizeClasses[size] || sizeClasses.md].join(' ')}>progress_activity</span>
	</div>
{/if}
