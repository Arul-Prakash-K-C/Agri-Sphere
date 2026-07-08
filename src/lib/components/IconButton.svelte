<script>
	let {
		icon = '',
		title = '',
		variant = 'ghost', // 'ghost' | 'primary' | 'danger' | 'outline'
		size = 'md', // 'sm' | 'md' | 'lg'
		disabled = false,
		onclick = null,
		class: customClass = ''
	} = $props();

	const variantClasses = {
		ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 active:scale-95',
		primary: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 border border-emerald-100/50',
		danger: 'bg-red-50 text-red-650 hover:bg-red-100 active:scale-95 border border-red-100/50',
		outline: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95'
	};

	const sizeClasses = {
		sm: 'p-1 rounded-lg text-lg',
		md: 'p-2 rounded-xl text-xl',
		lg: 'p-3 rounded-2xl text-2xl'
	};
</script>

<button
	type="button"
	{title}
	{disabled}
	onclick={onclick}
	class={[
		'inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none',
		variantClasses[variant] || variantClasses.ghost,
		sizeClasses[size] || sizeClasses.md,
		customClass
	].join(' ')}
>
	<span class="material-symbols-outlined leading-none font-medium">{icon}</span>
</button>
