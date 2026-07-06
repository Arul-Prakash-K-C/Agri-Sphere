import { preferences } from '../stores/preferences.svelte.js';

export function formatCurrency(amount, decimals = 0) {
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

export function getCurrencySymbol() {
	const currency = preferences.currency || 'INR';
	const symbolMap = {
		'INR': '₹',
		'USD': '$',
		'EUR': '€',
		'GBP': '£'
	};
	return symbolMap[currency] || '₹';
}

export function formatDate(dateVal, format = 'DD/MM/YYYY') {
	if (!dateVal) return '';
	const date = new Date(dateVal);
	if (isNaN(date.getTime())) return '';
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = date.getFullYear();
	if (format === 'YYYY-MM-DD') {
		return `${year}-${month}-${day}`;
	}
	return `${day}/${month}/${year}`;
}

export function getHarvestStatus(plantedDateStr, harvestDurationStr) {
	if (!harvestDurationStr) return "No duration specified";

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Case 1: Days (e.g. "90 Days" or "Days: 90")
	if (
		harvestDurationStr.toLowerCase().includes("days") ||
		/^\d+$/.test(harvestDurationStr.trim())
	) {
		const daysMatch = harvestDurationStr.match(/\d+/);
		if (daysMatch) {
			const days = parseInt(daysMatch[0], 10);
			const plantedDate = new Date(plantedDateStr);
			plantedDate.setHours(0, 0, 0, 0);

			const harvestDate = new Date(
				plantedDate.getTime() + days * 24 * 60 * 60 * 1000,
			);
			const diffTime = harvestDate.getTime() - today.getTime();
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

			if (diffDays > 0) {
				return `harvest in ${diffDays} days`;
			} else {
				return `Ready to harvest`;
			}
		}
	}

	// Case 2: Seasonal (e.g. "Seasonal (May, Jun, Jul, Aug, Sep, Oct)")
	if (harvestDurationStr.toLowerCase().includes("seasonal")) {
		const monthsMatch = harvestDurationStr.match(/\(([^)]+)\)/);
		if (monthsMatch) {
			const monthsList = monthsMatch[1]
				.split(",")
				.map((m) => m.trim())
				.filter(Boolean);
			const monthNames = [
				"Jan", "Feb", "Mar", "Apr", "May", "Jun",
				"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
			];

			const activeMonthIndices = monthsList
				.map((m) =>
					monthNames.findIndex((name) =>
						name.toLowerCase().startsWith(m.toLowerCase()),
					),
				)
				.filter((idx) => idx !== -1);

			if (activeMonthIndices.length === 0) return "Seasonal";

			const currentMonthIdx = today.getMonth();
			const currentYear = today.getFullYear();

			if (activeMonthIndices.includes(currentMonthIdx)) {
				return `Ready to harvest`;
			} else {
				const firstMonthName = monthsList[0];
				const firstMonthIdx = monthNames.findIndex((name) =>
					name
						.toLowerCase()
						.startsWith(firstMonthName.toLowerCase()),
				);

				let startYear = currentYear;
				if (firstMonthIdx < currentMonthIdx) {
					startYear = currentYear + 1;
				}

				const startDate = new Date(startYear, firstMonthIdx, 1);
				startDate.setHours(0, 0, 0, 0);

				const diffTime = startDate.getTime() - today.getTime();
				const diffDays = Math.ceil(
					diffTime / (1000 * 60 * 60 * 24),
				);

				return `season starts in ${diffDays} days`;
			}
		}
	}

	return harvestDurationStr;
}
