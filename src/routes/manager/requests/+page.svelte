<script>
	import { onMount } from 'svelte';

	let requests = $state([]);
	let loading = $state(true);
	let error = $state(null);

	async function fetchData() {
		loading = true;
		try {
			const res = await fetch('/api/manager/requests');
			if (res.ok) {
				requests = await res.json();
			} else {
				throw new Error('Failed to load requests');
			}
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	let pendingFarms = $derived(requests.filter(r => r.status === 'Pending'));
	let rejectedFarms = $derived(requests.filter(r => r.status === 'Rejected'));

	function getDaysAgo(iso) {
		if (!iso) return '';
		const diff = new Date() - new Date(iso);
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		return `${days} days ago`;
	}
	
	function getInitials(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}
</script>

<svelte:head>
	<title>Requests - Agri-Sphere</title>
</svelte:head>

<div class="space-y-8 max-w-2xl mx-auto pb-24">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">Farm Requests</h1>
		<p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Track the status of your access requests to farms.</p>
	</div>

	{#if loading}
		<div class="py-12 flex justify-center">
			<span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
		</div>
	{:else}
		<!-- Pending Requests -->
		<div class="space-y-4 px-1">
			<h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
				<span class="material-symbols-outlined text-amber-500 text-[20px]">more_horiz</span>
				Pending Requests
			</h3>
			
			{#if pendingFarms.length === 0}
				<div class="bg-slate-50 dark:bg-[#1a1f1b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
					You have no pending access requests.
				</div>
			{:else}
				<div class="grid gap-3">
					{#each pendingFarms as req}
						<div class="bg-white dark:bg-[#1f1f23] rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center gap-4">
							<div class="size-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center text-lg shrink-0">
								{getInitials(req.farmer?.farmName)}
							</div>
							<div class="flex-1 min-w-0">
								<h4 class="font-bold text-slate-900 dark:text-white text-sm truncate">{req.farmer?.farmName || 'Unnamed Farm'}</h4>
								<p class="text-xs text-slate-500 dark:text-slate-400 truncate">{req.farmer?.email}</p>
								<p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Requested {getDaysAgo(req.requestedAt)}</p>
							</div>
							<div class="px-3 py-1 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-500 text-xs font-bold bg-amber-50/50 dark:bg-amber-900/10">
								Pending
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Rejected Requests -->
		{#if rejectedFarms.length > 0}
			<div class="space-y-4 px-1 opacity-75 mt-8">
				<h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
					<span class="material-symbols-outlined text-red-500 text-[20px]">block</span>
					Rejected Requests
				</h3>
				<div class="grid gap-3">
					{#each rejectedFarms as req}
						<div class="bg-white dark:bg-[#1f1f23] rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
							<div class="size-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold flex items-center justify-center text-lg shrink-0">
								{getInitials(req.farmer?.farmName)}
							</div>
							<div class="flex-1 min-w-0">
								<h4 class="font-bold text-slate-900 dark:text-white text-sm truncate">{req.farmer?.farmName || 'Unnamed Farm'}</h4>
								<p class="text-xs text-slate-500 dark:text-slate-400 truncate">{req.farmer?.email}</p>
							</div>
							<div class="px-3 py-1 rounded-full border border-red-500/30 text-red-600 dark:text-red-500 text-xs font-bold bg-red-50/50 dark:bg-red-900/10">
								Rejected
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
