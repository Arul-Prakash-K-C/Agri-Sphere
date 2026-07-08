<script>
	import { preferences, setPreference } from '../stores/preferences.svelte.js';

	let {
		class: customClass = ''
	} = $props();

	function toggleTheme() {
		const nextTheme = preferences.theme === 'dark' ? 'light' : 'dark';
		setPreference('theme', nextTheme);
	}
</script>

<button
	type="button"
	onclick={toggleTheme}
	class={['text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 p-2 rounded-2xl transition-all scale-95 active:scale-90 flex items-center justify-center cursor-pointer', customClass].join(' ')}
	title="Toggle Color Theme"
>
	<span class="material-symbols-outlined text-[22px]">
		{preferences.theme === 'dark' ? 'light_mode' : 'dark_mode'}
	</span>
</button>
