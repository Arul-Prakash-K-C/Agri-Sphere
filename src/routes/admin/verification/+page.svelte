<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide, scale } from 'svelte/transition';
	import Modal from '$lib/components/Modal.svelte';
	import { browser } from '$app/environment';
	import { collection, onSnapshot } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Real-time state
	let users = $state([]);
	let loading = $state(true);
	let error = $state('');

	let unsubUsers;

	// Tabs: 'farmers' | 'buyers'
	let activeTab = $state('farmers');

	// Filters
	let filterStatus = $state('All'); // 'All', 'Pending', 'Verified', 'Rejected'
	let searchQuery = $state('');
	let sortByDate = $state('desc'); // 'desc' | 'asc'

	// Modal State
	let showDetailsModal = $state(false);
	let selectedUser = $state(null);
	let showRejectionReasonInput = $state(false);
	let rejectionReason = $state('');
	let actionLoading = $state(false);

	onMount(() => {
		if (!browser) return;

		users = data.users || [];
		loading = true;

		try {
			unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
				users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
				loading = false;
			}, (err) => {
				console.error('Error listening to users:', err);
				error = 'Failed to load real-time users list. Showing offline copy.';
				loading = false;
			});
		} catch (err) {
			console.error('Failed to set up users listener:', err);
			loading = false;
		}
	});

	onDestroy(() => {
		if (unsubUsers) unsubUsers();
	});

	// Helper to get status string
	function getVerificationStatus(user) {
		if (user.verificationStatus) return user.verificationStatus;
		if (user.verified === true) return 'Verified';
		return 'Pending'; // Default fallback status
	}

	// Dynamic filtration
	let filteredUsers = $derived.by(() => {
		let list = users.filter(u => {
			// Tab filtering
			const matchesRole = activeTab === 'farmers' ? u.role === 'farmer' : (u.role === 'customer' || u.role === 'buyer');
			
			// Status filtering
			const status = getVerificationStatus(u);
			const matchesStatus = filterStatus === 'All' || status === filterStatus;

			// Search text filtering
			const name = u.fullName || '';
			const email = u.email || '';
			const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			                      email.toLowerCase().includes(searchQuery.toLowerCase());

			return matchesRole && matchesStatus && matchesSearch;
		});

		// Date sorting
		list.sort((a, b) => {
			const timeA = new Date(a.createdAt || 0).getTime();
			const timeB = new Date(b.createdAt || 0).getTime();
			return sortByDate === 'desc' ? timeB - timeA : timeA - timeB;
		});

		return list;
	});

	// Custom pop-up modal state
	let showConfirmModal = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmCallback = $state(null);

	let showResultModal = $state(false);
	let resultTitle = $state('');
	let resultMessage = $state('');
	let isSuccessResult = $state(true);

	// Trigger Action POST
	async function updateVerification(userId, status, reason = '') {
		actionLoading = true;
		try {
			const res = await fetch('/api/admin/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, status, rejectionReason: reason })
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Failed to update user verification');
			}

			// Local state update
			users = users.map(u => {
				if (u.id === userId) {
					return {
						...u,
						verificationStatus: status,
						verified: status === 'Verified',
						rejectionReason: status === 'Rejected' ? reason : null
					};
				}
				return u;
			});

			// Reset modal flags
			showRejectionReasonInput = false;
			rejectionReason = '';
			showDetailsModal = false;
			selectedUser = null;
			showConfirmModal = false;

			// Trigger custom success notification popup
			isSuccessResult = true;
			resultTitle = 'Status Updated';
			resultMessage = `The user profile verification status has been successfully updated to ${status}.`;
			showResultModal = true;

			await invalidateAll();
		} catch (err) {
			isSuccessResult = false;
			resultTitle = 'Update Failed';
			resultMessage = err.message;
			showResultModal = true;
		} finally {
			actionLoading = false;
		}
	}

	function requestVerificationUpdate(userId, status, reason = '') {
		const actionWord = status === 'Verified' ? 'approve' : (status === 'Rejected' ? 'reject' : 'reset');
		confirmTitle = `${status === 'Verified' ? 'Approve' : (status === 'Rejected' ? 'Reject' : 'Reset')} Profile Verification?`;
		confirmMessage = `Are you sure you want to ${actionWord} this profile verification? This will immediately update the user status on the platform.`;
		confirmCallback = () => updateVerification(userId, status, reason);
		showConfirmModal = true;
	}

	function openDetails(user) {
		selectedUser = user;
		showRejectionReasonInput = false;
		rejectionReason = '';
		showDetailsModal = true;
	}

	function closeDetails() {
		showDetailsModal = false;
		selectedUser = null;
	}
</script>

<section class="mx-auto max-w-[1440px] px-2 py-6 sm:px-6 space-y-6 text-slate-800">
	<!-- Title Header -->
	<div class="border-b border-emerald-100 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-250 px-3 py-1 rounded-full">
				User Verifications 🛡️
			</span>
			<h1 class="text-3xl font-black text-slate-900 mt-2 tracking-tight">Credentials Verification Center</h1>
			<p class="text-slate-500 text-xs mt-1 font-semibold leading-relaxed">
				Approve new farmers, verify merchant backgrounds, evaluate buyer documentation, and review rejection histories.
			</p>
		</div>
		{#if error}
			<div class="bg-amber-50 border border-amber-250 text-amber-800 text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2">
				<span class="material-symbols-outlined text-[16px]">warning</span>
				<span>{error}</span>
			</div>
		{/if}
	</div>

	<!-- Layout Tabs -->
	<div class="bg-white border border-emerald-100 rounded-2xl p-2 shadow-sm flex items-center justify-between overflow-x-auto whitespace-nowrap gap-4">
		<div class="flex items-center gap-2">
			<button 
				onclick={() => { activeTab = 'farmers'; filterStatus = 'All'; }} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'farmers' ? 'bg-[#15803d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px]">agriculture</span>
				<span>Farmers ({users.filter(u => u.role === 'farmer').length})</span>
			</button>
			<button 
				onclick={() => { activeTab = 'buyers'; filterStatus = 'All'; }} 
				class={['px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer', 
					activeTab === 'buyers' ? 'bg-[#15803d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'].filter(Boolean).join(' ')}
			>
				<span class="material-symbols-outlined text-[16px]">person</span>
				<span>Buyers ({users.filter(u => u.role === 'customer' || u.role === 'buyer').length})</span>
			</button>
		</div>
	</div>

	<!-- Filters Toolbar -->
	<div class="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm space-y-4">
		<div class="grid gap-4 md:grid-cols-12 items-center">
			<!-- Search query inputs -->
			<div class="relative md:col-span-5 w-full">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
				<input 
					type="text" 
					bind:value={searchQuery}
					placeholder="Search by name, email..." 
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
				/>
			</div>

			<!-- Status Filter Option -->
			<div class="md:col-span-4 flex items-center gap-2">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Status</span>
				<div class="flex gap-1 overflow-x-auto">
					{#each ['All', 'Pending', 'Verified', 'Rejected'] as status}
						<button
							onclick={() => filterStatus = status}
							class={['px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap',
								filterStatus === status 
									? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
									: 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'].join(' ')}
						>
							{status}
						</button>
					{/each}
				</div>
			</div>

			<!-- Sort Filter Option -->
			<div class="md:col-span-3 flex items-center gap-2">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Registered</span>
				<select 
					bind:value={sortByDate} 
					class="w-full bg-slate-50 border border-slate-200/50 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-600 focus:ring-1 focus:ring-emerald-500 outline-none"
				>
					<option value="desc">Newest First</option>
					<option value="asc">Oldest First</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Results Table List -->
	<div class="bg-white border border-slate-250/50 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
		{#if loading}
			<div class="py-16 text-center">
				<span class="material-symbols-outlined text-4xl text-emerald-600 animate-spin">progress_activity</span>
				<p class="text-xs text-slate-400 font-bold mt-2">Fetching verification records...</p>
			</div>
		{:else if filteredUsers.length === 0}
			<div class="py-16 text-center text-slate-400">
				<span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">verified_user</span>
				<p class="font-bold">No users match your verification filters.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[9px] font-bold">
							<th class="p-4">Profile</th>
							<th class="p-4">Full Name</th>
							<th class="p-4">Email</th>
							<th class="p-4">Phone</th>
							{#if activeTab === 'farmers'}
								<th class="p-4">Farm Details</th>
							{/if}
							<th class="p-4">Registered</th>
							<th class="p-4">Status</th>
							<th class="p-4 text-center">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 font-semibold text-slate-650">
						{#each filteredUsers as user (user.id)}
							{@const status = getVerificationStatus(user)}
							<tr class="hover:bg-slate-50/50">
								<!-- Profile Photo -->
								<td class="p-4">
									<div class="size-8 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-extrabold text-xs uppercase shadow-sm">
										{(user.fullName || 'U')[0]}
									</div>
								</td>
								<!-- Full Name -->
								<td class="p-4 font-extrabold text-slate-800">{user.fullName || 'N/A'}</td>
								<!-- Email -->
								<td class="p-4">{user.email || 'N/A'}</td>
								<!-- Phone -->
								<td class="p-4">{user.phone || 'N/A'}</td>
								<!-- Farm Details -->
								{#if activeTab === 'farmers'}
									<td class="p-4">
										<p class="font-bold text-slate-700 leading-none">{user.farmName || 'Family Fields'}</p>
										<span class="text-[10px] text-slate-400 mt-1 block">{user.address || 'Local Fields'}</span>
									</td>
								{/if}
								<!-- Date -->
								<td class="p-4">
									{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
								</td>
								<!-- Status badge -->
								<td class="p-4">
									<span class={[
										'inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider',
										status === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
										(status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-250')
									].join(' ')}>
										{status}
									</span>
								</td>
								<!-- Action buttons -->
								<td class="p-4">
									<div class="flex items-center justify-center gap-2">
										<button
											onclick={() => openDetails(user)}
											class="px-2.5 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
										>
											Verify Details
										</button>
										{#if status === 'Pending'}
											<button
												onclick={() => requestVerificationUpdate(user.id, 'Verified')}
												class="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-slate-400 transition-all cursor-pointer flex items-center justify-center"
												title="Approve / Mark Verified"
											>
												<span class="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
											</button>
										{:else if status === 'Verified'}
											<button
												onclick={() => requestVerificationUpdate(user.id, 'Pending')}
												class="p-1 hover:text-red-700 hover:bg-red-50 rounded-lg text-slate-400 transition-all cursor-pointer flex items-center justify-center"
												title="Remove Verification"
											>
												<span class="material-symbols-outlined text-[16px] text-red-500">lock_open</span>
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Detailed User Verification Info Modal Overlay -->
	<Modal
		bind:show={showDetailsModal}
		size="lg"
		title="Credentials Specification Sheet"
	>
		{#if selectedUser}
			{@const status = getVerificationStatus(selectedUser)}
			<div class="space-y-4 text-xs font-semibold text-slate-700">
				<div class="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
					<div class="size-14 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-extrabold text-lg uppercase shadow">
						{(selectedUser.fullName || 'U')[0]}
					</div>
					<div>
						<h4 class="font-black text-slate-800 text-base leading-tight">{selectedUser.fullName || 'N/A'}</h4>
						<p class="text-xs text-slate-450 mt-1 capitalize">{selectedUser.role} • Registered on {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</p>
					</div>
				</div>

				<!-- Detailed Info Grid -->
				<div class="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
					<div>
						<span class="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">Email Address</span>
						<p class="text-slate-800 font-bold">{selectedUser.email || 'N/A'}</p>
					</div>
					<div>
						<span class="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">Phone Number</span>
						<p class="text-slate-800 font-bold">{selectedUser.phone || 'N/A'}</p>
					</div>
					{#if selectedUser.role === 'farmer'}
						<div>
							<span class="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">Farm House Identity</span>
							<p class="text-slate-800 font-bold">{selectedUser.farmName || 'N/A'}</p>
						</div>
						<div>
							<span class="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">Field Coordinates</span>
							<p class="text-slate-800 font-bold">{selectedUser.address || 'N/A'}</p>
						</div>
					{/if}
				</div>

				<!-- Uploaded Docs Section (Placeholder with premium mock papers look) -->
				<div class="space-y-2.5 border-t border-slate-100 pt-3">
					<h4 class="text-xs font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
						<span class="material-symbols-outlined text-[15px]">file_present</span>
						Uploaded Background Certificates
					</h4>
					
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div class="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between h-28 hover:bg-slate-100/50 transition-colors">
							<div>
								<p class="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">Government ID Identification</p>
								<p class="text-[10px] font-bold text-slate-655 mt-2">National Card / Passport</p>
							</div>
							<div class="flex justify-between items-center text-[10px] text-emerald-600 font-bold mt-2">
								<span>ID_Verification.pdf</span>
								<span class="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
							</div>
						</div>

						{#if selectedUser.role === 'farmer'}
							<div class="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between h-28 hover:bg-slate-100/50 transition-colors">
								<div>
									<p class="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">Merchant Ownership Papers</p>
									<p class="text-[10px] font-bold text-slate-655 mt-2">Land Registry Certificate</p>
								</div>
								<div class="flex justify-between items-center text-[10px] text-emerald-600 font-bold mt-2">
									<span>Land_Title_Proof.jpg</span>
									<span class="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
								</div>
							</div>
						{:else}
							<div class="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between h-28 hover:bg-slate-100/50 transition-colors">
								<div>
									<p class="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">Trade License Paper</p>
									<p class="text-[10px] font-bold text-slate-655 mt-2">Business License Record</p>
								</div>
								<div class="flex justify-between items-center text-[10px] text-emerald-600 font-bold mt-2">
									<span>Merchant_License.pdf</span>
									<span class="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Rejection Details Feed -->
				{#if status === 'Rejected'}
					<div class="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-red-700 animate-slide-in">
						<p class="font-extrabold uppercase text-[9px] tracking-wider">Reason for Previous Rejection</p>
						<p class="mt-1 leading-normal">{selectedUser.rejectionReason || 'No reason provided.'}</p>
					</div>
				{/if}

				<!-- Action Dialog Form -->
				{#if showRejectionReasonInput}
					<div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-slide-in" transition:slide={{ duration: 150 }}>
						<label for="rejection-txt" class="block text-xs font-extrabold text-slate-700">Please provide a reason for rejection:</label>
						<textarea
							id="rejection-txt"
							bind:value={rejectionReason}
							placeholder="e.g. Government registration photo is unclear or expired..."
							class="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
							rows="3"
						></textarea>
						<div class="flex justify-end gap-2 text-xs font-bold">
							<button onclick={() => { showRejectionReasonInput = false; }} class="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-150 cursor-pointer">
								Cancel
							</button>
							<button
								onclick={() => requestVerificationUpdate(selectedUser.id, 'Rejected', rejectionReason)}
								disabled={!rejectionReason.trim() || actionLoading}
								class="px-4 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
							>
								Confirm Reject
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#snippet footer()}
			{#if selectedUser && !showRejectionReasonInput}
				{@const status = getVerificationStatus(selectedUser)}
				<div class="flex gap-3 w-full">
					{#if status !== 'Verified'}
						<button
							onclick={() => requestVerificationUpdate(selectedUser.id, 'Verified')}
							disabled={actionLoading}
							class="flex-1 py-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
						>
							<span class="material-symbols-outlined text-[16px]">check_circle</span>
							Approve Profile
						</button>
					{/if}
					{#if status !== 'Rejected'}
						<button
							onclick={() => { showRejectionReasonInput = true; }}
							disabled={actionLoading}
							class="flex-1 py-3 text-xs font-bold rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
						>
							<span class="material-symbols-outlined text-[16px]">cancel</span>
							Reject Verification
						</button>
					{/if}
					{#if status === 'Verified' || status === 'Rejected'}
						<button
							onclick={() => requestVerificationUpdate(selectedUser.id, 'Pending')}
							disabled={actionLoading}
							class="flex-1 py-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
						>
							<span class="material-symbols-outlined text-[16px]">lock_open</span>
							Reset Verification
						</button>
					{/if}
				</div>
			{:else}
				<button onclick={closeDetails} class="btn-secondary w-full py-2.5 text-xs font-bold cursor-pointer">
					Close Details
				</button>
			{/if}
		{/snippet}
	</Modal>

	<!-- Custom Confirmation Dialog Modal Popup -->
	<Modal
		bind:show={showConfirmModal}
		size="sm"
		title={confirmTitle}
	>
		<p class="text-xs font-semibold text-slate-550 leading-relaxed">{confirmMessage}</p>
		{#snippet footer()}
			<div class="flex gap-3 w-full">
				<button
					type="button"
					onclick={() => { showConfirmModal = false; }}
					class="btn-secondary flex-1 py-2.5 text-xs font-bold cursor-pointer"
					disabled={actionLoading}
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmCallback}
					disabled={actionLoading}
					class="flex-1 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm"
				>
					{#if actionLoading}
						<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
						Updating…
					{:else}
						Confirm
					{/if}
				</button>
			</div>
		{/snippet}
	</Modal>

	<!-- Custom Result Status Modal Popup -->
	<Modal
		bind:show={showResultModal}
		size="sm"
		title={resultTitle}
	>
		<div class="text-center py-2 space-y-4">
			<div class="mx-auto size-12 rounded-full flex items-center justify-center {isSuccessResult ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-650'}">
				<span class="material-symbols-outlined text-2xl">{isSuccessResult ? 'check_circle' : 'error'}</span>
			</div>
			<p class="text-xs text-slate-500 leading-relaxed font-semibold">{resultMessage}</p>
		</div>
		{#snippet footer()}
			<button
				type="button"
				onclick={() => { showResultModal = false; }}
				class="w-full py-2.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer shadow-sm"
			>
				Okay
			</button>
		{/snippet}
	</Modal>
</section>
