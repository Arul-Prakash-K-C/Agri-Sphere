<script>
	let {
		show = $bindable(false),
		unreadCount = 0,
		notifications = [],
		onMarkAsRead = null,
		onMarkAllAsRead = null,
		onDeleteNotification = null
	} = $props();
</script>

{#if show}
	<div class="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-3 text-xs text-slate-700 dark:text-slate-200 animate-fade-in">
		<div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
			<div class="flex items-center gap-1.5">
				<span class="font-extrabold text-slate-800 dark:text-white">Notifications</span>
				{#if unreadCount > 0}
					<span class="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">{unreadCount} New</span>
				{/if}
			</div>
			{#if unreadCount > 0}
				<button onclick={onMarkAllAsRead} class="text-[9px] text-slate-500 hover:text-emerald-650 hover:underline font-bold cursor-pointer">Mark all read</button>
			{/if}
		</div>
		<div class="max-h-60 overflow-y-auto space-y-2.5 pr-1">
			{#each notifications as item}
				<div class={['p-2.5 rounded-xl border flex flex-col gap-1 transition-colors', item.read ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 font-normal' : 'bg-emerald-50/30 border-emerald-100/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-slate-800 dark:text-slate-100 font-bold'].join(' ')}>
					<div class="flex justify-between items-start gap-2">
						<span class="font-black truncate text-[11px] text-slate-800 dark:text-slate-200">{item.title}</span>
						<div class="flex items-center gap-2 shrink-0">
							{#if !item.read}
								<button onclick={() => onMarkAsRead?.(item.id)} class="text-[9px] text-emerald-600 hover:underline font-bold cursor-pointer">Mark read</button>
							{/if}
							<button onclick={() => onDeleteNotification?.(item.id)} class="text-[9px] text-red-500 hover:text-red-750 hover:underline font-bold cursor-pointer" title="Delete notification">Delete</button>
						</div>
					</div>
					<p class="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">{item.message}</p>
				</div>
			{:else}
				<div class="text-center text-slate-400 dark:text-slate-650 py-6 font-medium">
					<span class="material-symbols-outlined text-2xl text-slate-350 dark:text-slate-705 block">notifications_off</span>
					<p class="mt-1">No notifications yet.</p>
				</div>
			{/each}
		</div>
	</div>
{/if}
