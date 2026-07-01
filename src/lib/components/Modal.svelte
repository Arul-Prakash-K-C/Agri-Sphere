<script>
	import { fade, scale } from 'svelte/transition';
	import { onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';

	// Svelte 5 component props
	let {
		show = $bindable(false),
		title = '',
		size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
		type = 'custom', // 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'custom'
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		confirmColor = 'bg-emerald-600 hover:bg-emerald-700 text-white',
		cancelColor = 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200',
		showCancel = true,
		showClose = true,
		icon = '',
		loading = false,
		onConfirm = null,
		onCancel = null,
		closeOnOutsideClick = true,
		onSubmit = null, // dynamic form submit support
		footer = null, // custom footer snippet support
		children = null
	} = $props();

	let modalElement = $state(null);

	// Width classes mapping
	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-2xl'
	};

	// ESC Key listener
	function handleKeyDown(event) {
		if (event.key === 'Escape' && show) {
			handleClose();
		}
	}

	function handleOutsideClick(event) {
		if (closeOnOutsideClick && type !== 'confirm' && event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleClose() {
		if (onCancel) {
			onCancel();
		} else {
			show = false;
		}
	}

	// Focus trapping helper on mount/open
	$effect(() => {
		if (show && modalElement && browser) {
			tick().then(() => {
				const focusable = modalElement.querySelectorAll(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);
				if (focusable.length > 0) {
					focusable[0].focus();
				}
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if show}
	<!-- Overlay Backdrop (centers content, fixed so it scrolls background) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		transition:fade={{ duration: 150 }}
		onclick={handleOutsideClick}
		class="fixed top-0 left-0 w-screen h-screen bg-[#022c22]/15 backdrop-blur-[6px] flex items-center justify-center z-[100] p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- Modal Content Card Container (Glassmorphic design) -->
		<svelte:element
			this={onSubmit ? 'form' : 'div'}
			onsubmit={onSubmit}
			bind:this={modalElement}
			transition:scale={{ start: 0.95, duration: 180 }}
			class={[
				'w-full max-h-[90vh] bg-white/75 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-3xl overflow-hidden flex flex-col font-sans relative',
				sizeClasses[size] || sizeClasses.md
			].join(' ')}
		>
			<!-- Header Block (always visible, glassmorphic header) -->
			<div class="flex justify-between items-center px-6 py-4 border-b border-emerald-100/30 flex-shrink-0 bg-white/50">
				<h3 class="font-extrabold text-slate-800 text-base flex items-center gap-2">
					{#if icon}
						<span class="material-symbols-outlined font-bold text-lg leading-none">{icon}</span>
					{:else if type === 'success'}
						<span class="material-symbols-outlined text-emerald-600 font-bold text-lg leading-none">check_circle</span>
					{:else if type === 'error'}
						<span class="material-symbols-outlined text-red-500 font-bold text-lg leading-none">error</span>
					{:else if type === 'warning'}
						<span class="material-symbols-outlined text-amber-500 font-bold text-lg leading-none">warning</span>
					{:else if type === 'info'}
						<span class="material-symbols-outlined text-blue-500 font-bold text-lg leading-none">info</span>
					{:else if type === 'confirm'}
						<span class="material-symbols-outlined text-emerald-600 font-bold text-lg leading-none">help</span>
					{/if}
					<span>{title || 'Dialog Details'}</span>
				</h3>
				{#if showClose && type !== 'confirm'}
					<button
						type="button"
						onclick={handleClose}
						class="text-slate-400 hover:text-slate-650 transition-all p-1.5 rounded-full hover:bg-slate-100/60 flex items-center cursor-pointer active:scale-95"
						aria-label="Close modal"
					>
						<span class="material-symbols-outlined text-lg leading-none">close</span>
					</button>
				{/if}
			</div>

			<!-- Body Block (scrollable, flex-grow) -->
			<div class="px-6 py-5 overflow-y-auto flex-grow space-y-4">
				{#if children}
					<!-- Render Slot/Snippets -->
					{@render children()}
				{/if}
			</div>

			<!-- Footer Block (always visible, glassmorphic footer) -->
			{#if footer}
				<div class="px-6 py-4 border-t border-emerald-100/30 flex gap-3 justify-end flex-shrink-0 bg-slate-50/50">
					{@render footer()}
				</div>
			{:else}
				{#if type !== 'custom'}
					<div class="px-6 py-4 border-t border-emerald-100/30 flex gap-3 justify-end flex-shrink-0 bg-slate-50/50">
						{#if showCancel || type === 'confirm'}
							<button
								type="button"
								onclick={handleClose}
								class={["px-4 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer", cancelColor].join(' ')}
							>
								{cancelText}
							</button>
						{/if}
						<button
							type={onSubmit ? 'submit' : 'button'}
							onclick={onSubmit ? null : (onConfirm || handleClose)}
							disabled={loading}
							class={["px-5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed", confirmColor].join(' ')}
						>
							{#if loading}
								<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
							{/if}
							<span>{confirmText}</span>
						</button>
					</div>
				{/if}
			{/if}
		</svelte:element>
	</div>
{/if}
