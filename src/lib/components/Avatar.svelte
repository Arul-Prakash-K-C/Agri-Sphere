<script>
	let {
		name = '',
		imageUrl = '',
		size = 'md', // 'sm' | 'md' | 'lg'
		class: customClass = ''
	} = $props();

	const initials = $derived(name ? name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?');

	const sizeClasses = {
		sm: 'size-7 text-xs rounded-xl',
		md: 'size-9 text-sm rounded-2xl',
		lg: 'size-12 text-base rounded-full'
	};
</script>

<div class={['bg-linear-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-extrabold shadow-sm uppercase shrink-0', sizeClasses[size] || sizeClasses.md, customClass].join(' ')}>
	{#if imageUrl}
		<img src={imageUrl} alt={name} class="w-full h-full object-cover rounded-[inherit]" />
	{:else}
		<span>{initials}</span>
	{/if}
</div>
