// Svelte 5 global state store for programmatic alert/confirm modals
export const modalState = $state({
	show: false,
	type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'custom'
	title: '',
	message: '',
	icon: '',
	confirmText: 'Confirm',
	cancelText: 'Cancel',
	confirmColor: 'bg-emerald-600 hover:bg-emerald-700',
	cancelColor: 'bg-white hover:bg-slate-100 text-slate-600',
	showCancel: true,
	showClose: true,
	loading: false,
	onConfirm: null,
	onCancel: null
});

let autoCloseTimeout = null;

function clearAutoClose() {
	if (autoCloseTimeout) {
		clearTimeout(autoCloseTimeout);
		autoCloseTimeout = null;
	}
}

/**
 * Show a configurable alert modal
 */
export function showAlert(options = {}) {
	clearAutoClose();
	return new Promise((resolve) => {
		const {
			title = 'Alert',
			message = '',
			type = 'info',
			icon = '',
			confirmText = 'Okay',
			confirmColor = 'bg-emerald-600 hover:bg-emerald-700 text-white',
			showClose = true,
			autoCloseDuration = 0
		} = options;

		modalState.title = title;
		modalState.message = message;
		modalState.type = type;
		modalState.icon = icon;
		modalState.confirmText = confirmText;
		modalState.confirmColor = confirmColor;
		modalState.showCancel = false;
		modalState.showClose = showClose;
		modalState.loading = false;
		modalState.show = true;

		modalState.onConfirm = () => {
			clearAutoClose();
			modalState.show = false;
			resolve(true);
		};
		modalState.onCancel = null;

		if (autoCloseDuration > 0 && (type === 'success' || type === 'info')) {
			autoCloseTimeout = setTimeout(() => {
				modalState.onConfirm();
			}, autoCloseDuration);
		}
	});
}

/**
 * Show a confirmation modal
 */
export function showConfirm(options = {}) {
	clearAutoClose();
	return new Promise((resolve) => {
		const {
			title = 'Confirm Action',
			message = '',
			type = 'confirm',
			icon = '',
			confirmText = 'Confirm',
			cancelText = 'Cancel',
			confirmColor = 'bg-emerald-600 hover:bg-emerald-700 text-white',
			cancelColor = 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200',
			showClose = true
		} = options;

		modalState.title = title;
		modalState.message = message;
		modalState.type = type;
		modalState.icon = icon;
		modalState.confirmText = confirmText;
		modalState.cancelText = cancelText;
		modalState.confirmColor = confirmColor;
		modalState.cancelColor = cancelColor;
		modalState.showCancel = true;
		modalState.showClose = showClose;
		modalState.loading = false;
		modalState.show = true;

		modalState.onConfirm = () => {
			modalState.show = false;
			resolve(true);
		};
		modalState.onCancel = () => {
			modalState.show = false;
			resolve(false);
		};
	});
}

export function showSuccess(message, title = 'Success', duration = 3000) {
	return showAlert({
		title,
		message,
		type: 'success',
		autoCloseDuration: duration
	});
}

export function showError(message, title = 'Error') {
	return showAlert({
		title,
		message,
		type: 'error',
		confirmColor: 'bg-red-600 hover:bg-red-700 text-white'
	});
}

export function showWarning(message, title = 'Warning') {
	return showAlert({
		title,
		message,
		type: 'warning',
		confirmColor: 'bg-amber-600 hover:bg-amber-700 text-white'
	});
}
