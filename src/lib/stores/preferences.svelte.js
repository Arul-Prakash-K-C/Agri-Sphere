import { browser } from '$app/environment';

// Preferences stores
export const preferences = $state({
	theme: 'light',
	currency: 'INR',
	dateFormat: 'DD/MM/YYYY'
});

// Load preferences from localStorage in browser context
export function loadPreferences() {
	if (!browser) return;
	let loadedTheme = localStorage.getItem('pref_theme') || 'light';
	if (loadedTheme === 'system') {
		loadedTheme = 'light';
		localStorage.setItem('pref_theme', 'light');
	}
	preferences.theme = loadedTheme;
	preferences.currency = localStorage.getItem('pref_currency') || 'INR';
	preferences.dateFormat = localStorage.getItem('pref_date_format') || 'DD/MM/YYYY';
	applyTheme(preferences.theme);
}

// Set/Update single preference
export function setPreference(key, value) {
	if (!browser) return;
	if (key === 'theme') {
		let val = value;
		if (val === 'system') {
			val = 'light';
		}
		preferences.theme = val;
		localStorage.setItem('pref_theme', val);
		applyTheme(val);
	} else if (key === 'currency') {
		preferences.currency = value;
		localStorage.setItem('pref_currency', value);
		// Dispatch event to notify standard currency-dependent elements
		window.dispatchEvent(new CustomEvent('currency-changed', { detail: value }));
	} else if (key === 'dateFormat') {
		preferences.dateFormat = value;
		localStorage.setItem('pref_date_format', value);
	}
}

// Function to format currency globally based on selected preference
export function formatCurrencyGlobal(amount, decimals = 0) {
	const currency = preferences.currency || 'INR';
	const localeMap = {
		'INR': 'en-IN',
		'USD': 'en-US',
		'EUR': 'de-DE',
		'GBP': 'en-GB'
	};
	const locale = localeMap[currency] || 'en-IN';
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(amount || 0);
}

// Helper function to return currency symbol
export function getCurrencySymbolGlobal() {
	const currency = preferences.currency || 'INR';
	const symbolMap = {
		'INR': '₹',
		'USD': '$',
		'EUR': '€',
		'GBP': '£'
	};
	return symbolMap[currency] || '₹';
}

// Local helper to apply theme to HTML element
export function applyTheme(theme) {
	if (!browser) return;
	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}
