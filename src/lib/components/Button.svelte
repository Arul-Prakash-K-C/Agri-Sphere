<script>
	let {
		type = 'button',
		variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
		size = 'md', // 'sm' | 'md' | 'lg'
		disabled = false,
		loading = false,
		onclick = null,
		children = null,
		class: customClass = ''
	} = $props();

	const variantClasses = {
		primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 active:scale-[0.98]',
		secondary: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 active:scale-[0.98]',
		outline: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98]',
		danger: 'bg-red-650 hover:bg-red-700 text-white shadow-md shadow-red-650/10 active:scale-[0.98]',
		ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 active:scale-[0.98]'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-xs rounded-lg font-medium',
		md: 'px-5 py-2.5 text-sm rounded-xl font-bold',
		lg: 'px-8 py-4 text-base rounded-2xl font-bold'
	};
</script>

<button
	{type}
	{disabled}
	onclick={onclick}
	class={[
		'inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none outline-none focus:ring-2 focus:ring-emerald-500/20',
		variantClasses[variant] || variantClasses.primary,
		sizeClasses[size] || sizeClasses.md,
		customClass
	].join(' ')}
>
	{#if loading}
		<span class="material-symbols-outlined text-[1.25em] animate-spin">progress_activity</span>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
