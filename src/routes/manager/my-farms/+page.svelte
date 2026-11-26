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

	async function openFarm(farmerId) {
		try {
			const res = await fetch('/api/manager/active-farm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ farmerId })
			});
			
			if (res.ok) {
				window.location.href = '/farmer/dashboard';
			} else {
				alert('Failed to set active farm');
			}
		} catch (err) {
			alert('An error occurred');
		}
	}

	let approvedFarms = $derived(requests.filter(r => r.status === 'Accepted'));

	function getInitials(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}
</script>

<svelte:head>
	<title>My Farms - Agri-Sphere</title>
</svelte:head>

<div class="space-y-8 max-w-2xl mx-auto pb-24">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">My Farms</h1>
		<p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Access and monitor farms you have been approved for in read-only mode.</p>
	</div>

	{#if loading}
		<div class="py-12 flex justify-center">
			<span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
		</div>
	{:else}
		<!-- Approved Farms -->
		<div class="space-y-4 px-1">
			<h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
				<span class="material-symbols-outlined text-emerald-500 text-[20px]">verified</span>
				Approved Farms
			</h3>
			
			{#if approvedFarms.length === 0}
				<div class="bg-slate-50 dark:bg-[#1a1f1b] border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-6 flex items-center gap-4">
					<div class="shrink-0 text-emerald-500">
						<span class="material-symbols-outlined text-5xl">inventory</span>
					</div>
					<div>
						<h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm">You don't have access to any farms yet.</h4>
						<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Once a farmer approves your request, their farms will appear here.</p>
					</div>
				</div>
			{:else}
				<div class="grid gap-4">
					{#each approvedFarms as req}
						<button 
							onclick={() => openFarm(req.farmerId)}
							class="text-left bg-white dark:bg-slate-800 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:shadow-md transition-all group flex items-center gap-4"
						>
							<div class="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-lg shrink-0">
								{getInitials(req.farmer?.farmName)}
							</div>
							<div class="flex-1 min-w-0">
								<h4 class="font-bold text-slate-900 dark:text-white text-base truncate">
									{req.farmer?.farmName || 'Unnamed Farm'}
								</h4>
								<p class="text-xs text-slate-500 dark:text-slate-400 truncate">{req.farmer?.fullName} &bull; {req.farmer?.email}</p>
							</div>
							<div class="size-8 rounded-full bg-emerald-50 dark:bg-slate-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
								<span class="material-symbols-outlined text-[18px]">arrow_forward</span>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
