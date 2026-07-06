<script>
	import { fade } from 'svelte/transition';

	let {
		message = '',
		type = 'info', // 'success' | 'error' | 'info' | 'warning'
		show = $bindable(false),
		duration = 3000
	} = $props();

	$effect(() => {
		if (show && message) {
			const timer = setTimeout(() => {
				show = false;
			}, duration);
			return () => clearTimeout(timer);
		}
	});

	const typeClasses = {
		success: 'bg-emerald-600 text-white shadow-emerald-600/10',
		error: 'bg-red-650 text-white shadow-red-650/10',
		warning: 'bg-amber-500 text-white shadow-amber-500/10',
		info: 'bg-slate-800 text-white shadow-slate-800/10'
	};

	const icons = {
		success: 'check_circle',
		error: 'error',
		warning: 'warning',
		info: 'info'
	};
</script>

{#if show && message}
	<div
		transition:fade={{ duration: 150 }}
		class={[
			'fixed bottom-6 right-6 px-4 py-3 rounded-2xl flex items-center gap-2.5 shadow-2xl z-[150] text-xs font-bold border border-white/10 max-w-sm',
			typeClasses[type] || typeClasses.info
		].join(' ')}
	>
		<span class="material-symbols-outlined text-[18px]">{icons[type] || 'info'}</span>
		<span>{message}</span>
	</div>
{/if}
