<script>
	let {
		class: customClass = ''
	} = $props();

	let selectedLanguage = $state('en');

	const languages = [
		{ value: 'en', label: 'English' },
		{ value: 'hi', label: 'Hindi (हिंदी)' },
		{ value: 'pb', label: 'Punjabi (ਪੰਜਾਬੀ)' }
	];
</script>

<div class={['flex items-center gap-2', customClass].join(' ')}>
	<span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Language</span>
	<select
		bind:value={selectedLanguage}
		class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-2.5 text-xs font-bold text-slate-650 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
	>
		{#each languages as lang}
			<option value={lang.value}>{lang.label}</option>
		{/each}
	</select>
</div>
