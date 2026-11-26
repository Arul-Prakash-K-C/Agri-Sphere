<script>
	import { onMount } from 'svelte';

	let requests = $state([]);
	let loading = $state(true);
	let processingId = $state(null);

	async function fetchRequests() {
		loading = true;
		try {
			const res = await fetch('/api/farmer/managers');
			if (res.ok) {
				requests = await res.json();
			}
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	onMount(fetchRequests);

	async function updateRequest(id, status) {
		processingId = id;
		try {
			const res = await fetch('/api/farmer/managers', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requestId: id, status })
			});
			if (res.ok) {
				await fetchRequests();
			} else {
				alert('Failed to update request.');
			}
		} catch (err) {
			alert('An error occurred.');
		} finally {
			processingId = null;
		}
	}

	let pendingRequests = $derived(requests.filter(r => r.status === 'Pending'));
	let approvedManagers = $derived(requests.filter(r => r.status === 'Accepted'));

	function formatDate(iso) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Manage Access - Agri-Sphere</title>
</svelte:head>

<section class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<div>
		<h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">Farm Access Management</h2>
		<p class="text-sm text-slate-500 mt-1">Review access requests and manage approved managers for your farm.</p>
	</div>

	{#if loading}
		<div class="py-12 flex justify-center">
			<span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
		</div>
	{:else}
		<div class="space-y-8">
			<!-- Pending Requests -->
			<div class="space-y-4">
				<h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
					<span class="material-symbols-outlined text-amber-500">pending</span>
					Pending Requests
				</h3>
				{#if pendingRequests.length === 0}
					<div class="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-500 text-sm">
						No pending access requests.
					</div>
				{:else}
					<div class="grid gap-4">
						{#each pendingRequests as req}
							<div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div>
									<h4 class="font-bold text-slate-800">{req.manager?.fullName || 'Manager'}</h4>
									<p class="text-sm text-slate-500">{req.manager?.email}</p>
									<p class="text-xs text-slate-400 mt-1">Requested on {formatDate(req.requestedAt)}</p>
								</div>
								<div class="flex gap-2">
									<button 
										onclick={() => updateRequest(req.id, 'Rejected')}
										disabled={processingId === req.id}
										class="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
									>
										Reject
									</button>
									<button 
										onclick={() => updateRequest(req.id, 'Accepted')}
										disabled={processingId === req.id}
										class="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
									>
										Approve Access
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Approved Managers -->
			<div class="space-y-4">
				<h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
					<span class="material-symbols-outlined text-emerald-500">verified_user</span>
					Approved Managers
				</h3>
				{#if approvedManagers.length === 0}
					<div class="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-500 text-sm">
						You haven't granted access to any managers.
					</div>
				{:else}
					<div class="grid gap-4">
						{#each approvedManagers as req}
							<div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div class="flex items-center gap-3">
									<div class="size-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
										{req.manager?.fullName?.charAt(0) || 'M'}
									</div>
									<div>
										<h4 class="font-bold text-slate-800">{req.manager?.fullName || 'Manager'}</h4>
										<p class="text-sm text-slate-500">{req.manager?.email}</p>
										<p class="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1 w-fit">
											Read-Only Access
										</p>
									</div>
								</div>
								<button 
									onclick={() => updateRequest(req.id, 'Revoked')}
									disabled={processingId === req.id}
									class="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
								>
									Revoke Access
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
