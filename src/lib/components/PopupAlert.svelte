<script>
	let {
		type = 'info', // 'success' | 'error' | 'warning' | 'info'
		message = '',
		class: customClass = ''
	} = $props();

	const typeClasses = {
		success: 'bg-emerald-50 border-emerald-100/50 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300',
		error: 'bg-red-50 border-red-100/50 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-300',
		warning: 'bg-amber-50 border-amber-100/50 text-amber-805 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300',
		info: 'bg-blue-50 border-blue-100/50 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300'
	};

	const icons = {
		success: 'check_circle',
		error: 'error',
		warning: 'warning',
		info: 'info'
	};
</script>

{#if message}
	<div class={['rounded-2xl border px-4 py-3 text-xs font-semibold flex items-start gap-2.5 shadow-sm animate-fade-in', typeClasses[type] || typeClasses.info, customClass].join(' ')}>
		<span class="material-symbols-outlined text-[18px] leading-none shrink-0">{icons[type] || 'info'}</span>
		<div class="flex-1 leading-relaxed">
			{message}
		</div>
	</div>
{/if}
