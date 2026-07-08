<script>
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let {
		align = 'right', // 'left' | 'right'
		trigger = null, // Trigger snippet
		children = null, // Items snippet
		class: customClass = ''
	} = $props();

	let open = $state(false);
	let element = $state(null);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function handleOutsideClick(event) {
		if (open && element && !element.contains(event.target)) {
			close();
		}
	}

	$effect(() => {
		if (browser) {
			window.addEventListener('click', handleOutsideClick);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('click', handleOutsideClick);
		}
	});
</script>

<div bind:this={element} class={['relative inline-block text-left', customClass].join(' ')}>
	{#if trigger}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div onclick={toggle}>
			{@render trigger()}
		</div>
	{:else}
		<button
			type="button"
			onclick={toggle}
			class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-center cursor-pointer"
		>
			<span class="material-symbols-outlined text-[20px]">more_vert</span>
		</button>
	{/if}

	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onclick={close}
			class={[
				'absolute mt-2 w-48 rounded-2xl shadow-xl bg-white dark:bg-[#1e1e1e] border border-slate-200/50 dark:border-slate-800 py-1.5 z-[90] animate-fade-in',
				align === 'right' ? 'right-0' : 'left-0'
			].join(' ')}
		>
			{#if children}
				{@render children()}
			{/if}
		</div>
	{/if}
</div>
