<script>
	import { preferences, setPreference } from '../stores/preferences.svelte.js';

	let {
		class: customClass = ''
	} = $props();

	const currencies = [
		{ value: 'INR', label: 'INR (₹)' },
		{ value: 'USD', label: 'USD ($)' },
		{ value: 'EUR', label: 'EUR (€)' },
		{ value: 'GBP', label: 'GBP (£)' }
	];
</script>

<div class={['flex items-center gap-2', customClass].join(' ')}>
	<span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Currency</span>
	<select
		value={preferences.currency}
		onchange={(e) => setPreference('currency', e.target.value)}
		class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-2.5 text-xs font-bold text-slate-650 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
	>
		{#each currencies as curr}
			<option value={curr.value}>{curr.label}</option>
		{/each}
	</select>
</div>
