<script>
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();
	
	let requests = $state([]);
	let allFarms = $state([]);
	let loading = $state(true);
	let error = $state(null);

	let isSubmittingId = $state(null); 
	let submitMessage = $state(null);

	async function fetchData() {
		loading = true;
		try {
			const [reqRes, farmsRes] = await Promise.all([
				fetch('/api/manager/requests'),
				fetch('/api/manager/farms')
			]);
			
			if (reqRes.ok && farmsRes.ok) {
				requests = await reqRes.json();
				allFarms = await farmsRes.json();
			} else {
				throw new Error('Failed to load data');
			}
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	async function requestAccess(email, farmerId) {
		isSubmittingId = farmerId;
		submitMessage = null;
		
		try {
			const res = await fetch('/api/manager/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			
			const data = await res.json();
			
			if (res.ok) {
				submitMessage = { type: 'success', text: 'Access request sent successfully!' };
				await fetchData();
			} else {
				submitMessage = { type: 'error', text: data.error || 'Failed to send request' };
			}
		} catch (err) {
			submitMessage = { type: 'error', text: 'An unexpected error occurred.' };
		} finally {
			isSubmittingId = null;
			setTimeout(() => submitMessage = null, 3000);
		}
	}

	function getRequestStatus(farmerId) {
		const req = requests.find(r => r.farmerId === farmerId);
		return req ? req.status : null;
	}

	function getInitials(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}
</script>

<svelte:head>
	<title>Farms - Agri-Sphere</title>
</svelte:head>

<div class="space-y-8 max-w-5xl mx-auto pb-24">
	<!-- Header -->
	<div>
		<p class="text-sm text-slate-400 dark:text-slate-400">Welcome back, {data.profile?.fullName?.split(' ')[0] || 'Manager'} 👋</p>
		<h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">Farms Directory</h1>
		<p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Browse available farms and request access to monitor their operations.</p>
	</div>

	<!-- All Farms -->
	<div class="space-y-4">
		<div class="flex items-center justify-between px-1">
			<h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
				<span class="material-symbols-outlined text-orange-500 text-[20px]">storefront</span>
				All Farms
			</h2>
		</div>

		{#if submitMessage}
			<div class="text-sm px-3 py-2 rounded-xl font-bold {submitMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} animate-fade-in mx-1">
				{submitMessage.text}
			</div>
		{/if}

		{#if loading}
			<div class="h-32 flex items-center justify-center">
				<span class="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
			</div>
		{:else if allFarms.length === 0}
			<div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 border-dashed rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm mx-1">
				No farms found in the system.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
				{#each allFarms as farm}
					{@const status = getRequestStatus(farm.id)}
					<div class="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
						<div>
							<div class="flex items-start justify-between mb-3">
								<div class="size-10 rounded-full bg-emerald-200 dark:bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center">
									{getInitials(farm.farmName)}
								</div>
								{#if status === 'Accepted'}
									<span class="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">Approved</span>
								{:else if status === 'Pending'}
									<span class="px-2 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">Pending</span>
								{:else if status === 'Rejected'}
									<span class="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-md text-[10px] font-bold">Rejected</span>
								{/if}
							</div>
							
							<h4 class="font-bold text-slate-900 dark:text-white text-base">{farm.farmName}</h4>
							<p class="text-sm text-slate-600 dark:text-slate-400 mt-1">{farm.fullName}</p>
							<p class="text-xs text-slate-500 dark:text-slate-500 truncate mt-0.5">{farm.email}</p>
						</div>
						
						{#if !status || status === 'Rejected'}
							<Button 
								variant="primary" 
								class="w-full mt-5 !py-2.5 !text-sm !font-bold" 
								onclick={() => requestAccess(farm.email, farm.id)}
								disabled={isSubmittingId === farm.id}
							>
								{isSubmittingId === farm.id ? 'Requesting...' : 'Request Access'}
							</Button>
						{:else}
							<button 
								class="w-full mt-5 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed bg-transparent" 
								disabled
							>
								Requested
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
