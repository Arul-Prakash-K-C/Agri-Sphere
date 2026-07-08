<script>
	let {
		children = null,
		class: customClass = '',
		onclick = null
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<tr 
	onclick={onclick}
	class={[
		'border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors',
		onclick ? 'cursor-pointer' : '',
		customClass
	].join(' ')}
>
	{#if children}
		{@render children()}
	{/if}
</tr>
