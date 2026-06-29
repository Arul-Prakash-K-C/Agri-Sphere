// Svelte 5 global state store for programmatic alert/confirm modals
export const modalState = $state({
	show: false,
	type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
	title: '',
	message: '',
	confirmText: 'Confirm',
	cancelText: 'Cancel',
	onConfirm: null,
	onCancel: null
});

/**
 * Show a simple alert modal
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {'success'|'error'|'warning'|'info'} [params.type='info']
 * @returns {Promise<boolean>} Resolves to true when clicked Okay/Close
 */
export function showAlert({ title, message, type = 'info' }) {
	return new Promise((resolve) => {
		modalState.title = title;
		modalState.message = message;
		modalState.type = type;
		modalState.confirmText = 'Okay';
		modalState.show = true;
		modalState.onConfirm = () => {
			modalState.show = false;
			resolve(true);
		};
		modalState.onCancel = null;
	});
}

/**
 * Show a confirmation modal
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.confirmText='Confirm']
 * @param {string} [params.cancelText='Cancel']
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export function showConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
	return new Promise((resolve) => {
		modalState.title = title;
		modalState.message = message;
		modalState.type = 'confirm';
		modalState.confirmText = confirmText;
		modalState.cancelText = cancelText;
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
