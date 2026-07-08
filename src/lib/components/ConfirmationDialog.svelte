<script>
	import Modal from './Modal.svelte';

	let {
		show = $bindable(false),
		title = 'Are you sure?',
		message = '',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		confirmColor = 'bg-red-600 hover:bg-red-700 text-white',
		cancelColor = 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200',
		loading = false,
		onConfirm = null,
		onCancel = null
	} = $props();

	function handleConfirm() {
		if (onConfirm) {
			onConfirm();
		} else {
			show = false;
		}
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
		} else {
			show = false;
		}
	}
</script>

<Modal
	bind:show={show}
	{title}
	type="confirm"
	{confirmText}
	{cancelText}
	{confirmColor}
	{cancelColor}
	{loading}
	onConfirm={handleConfirm}
	onCancel={handleCancel}
	size="sm"
>
	<p class="text-xs text-slate-500 leading-relaxed font-semibold dark:text-slate-400">
		{message}
	</p>
</Modal>
