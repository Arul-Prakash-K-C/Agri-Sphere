import { browser } from '$app/environment';

export function applyTheme(theme) {
	if (!browser) return;
	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}
