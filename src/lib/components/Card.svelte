<script>
	let { 
		imageUrl, 
		title, 
		subtitle = '', 
		subtitleSnippet,
		actions, 
		children,
		footer
	} = $props();
</script>

<article class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
	<!-- Card Image Section -->
	<div class="relative h-48 w-full overflow-hidden shrink-0">
		<img 
			src={imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80'} 
			alt={title} 
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
		/>
		<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
		
		<!-- Top Right Actions -->
		{#if actions}
			<div class="absolute top-3 right-3 flex gap-1.5 z-10">
				{@render actions()}
			</div>
		{/if}
		
		<!-- Bottom Left Image Overlay Info -->
		<div class="absolute bottom-3 left-4 text-white z-10">
			<h3 class="text-lg font-extrabold leading-none">{title}</h3>
			{#if subtitleSnippet}
				{@render subtitleSnippet()}
			{:else if subtitle}
				<p class="text-[10px] opacity-90 mt-1 font-semibold">{subtitle}</p>
			{/if}
		</div>
	</div>

	<!-- Card Body Content Section -->
	<div class="p-5 flex-grow flex flex-col justify-between gap-4">
		{#if children}
			<div class="flex-grow flex flex-col justify-between gap-4">
				{@render children()}
			</div>
		{/if}
		
		{#if footer}
			<div class="border-t border-slate-100 pt-3">
				{@render footer()}
			</div>
		{/if}
	</div>
</article>
