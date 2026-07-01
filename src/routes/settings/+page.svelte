<script>
	import { fade, slide } from 'svelte/transition';
	import { authState } from '$lib/auth.svelte.js';
	import { logout } from '$lib/firebase-data';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/firebase';
	import { sendPasswordResetEmail } from 'firebase/auth';
	import Modal from '$lib/components/Modal.svelte';
	import { showConfirm, showSuccess, showError } from '$lib/modal.svelte.js';

	// Inline editing state
	let editing = $state(false);
	let editName = $state('');
	let editPhone = $state('');
	let editFarmName = $state('');
	let editFarmArea = $state('');
	let editAddress = $state('');
	let saving = $state(false);
	let saveError = $state('');

	// Account deletion state
	let showDeleteModal = $state(false);
	let deleteInputEmail = $state('');
	let deleting = $state(false);
	let deleteError = $state('');

	// Preferences state (cached in localStorage)
	let activeTheme = $state('system');
	let activeCurrency = $state('INR');
	let activeDateFormat = $state('DD/MM/YYYY');



	// Password reset state
	let passwordResetSent = $state(false);
	let passwordResetError = $state('');

	$effect(() => {
		// Initialize fields when profile is loaded
		if (authState.profile && !editing) {
			editName = authState.profile.fullName || '';
			editPhone = authState.profile.phone || '';
			editFarmName = authState.profile.farmName || '';
			editFarmArea = String(authState.profile.farmArea || '0');
			editAddress = authState.profile.address || '';
		}
	});

	// Load Preferences from localStorage on mount
	import { onMount } from 'svelte';
	onMount(() => {
		if (typeof window !== 'undefined') {
			activeTheme = localStorage.getItem('pref_theme') || 'system';
			activeCurrency = localStorage.getItem('pref_currency') || 'INR';
			activeDateFormat = localStorage.getItem('pref_date_format') || 'DD/MM/YYYY';
		}
	});

	function handlePrefChange(key, val) {
		if (typeof window !== 'undefined') {
			localStorage.setItem(`pref_${key}`, val);
			if (key === 'theme') {
				// Apply theme changes to document class
				if (val === 'dark') {
					document.documentElement.classList.add('dark');
				} else if (val === 'light') {
					document.documentElement.classList.remove('dark');
				} else {
					// System theme detection
					const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
					if (darkMedia.matches) {
						document.documentElement.classList.add('dark');
					} else {
						document.documentElement.classList.remove('dark');
					}
				}
			}
		}
	}

	function startEditing() {
		editName = authState.profile?.fullName || '';
		editPhone = authState.profile?.phone || '';
		editFarmName = authState.profile?.farmName || '';
		editFarmArea = String(authState.profile?.farmArea || '0');
		editAddress = authState.profile?.address || '';
		saveError = '';
		editing = true;
	}

	async function saveProfile() {
		saving = true;
		saveError = '';

		try {
			const payload = {
				fullName: editName,
				phone: editPhone
			};

			if (authState.profile.role === 'farmer') {
				payload.farmName = editFarmName;
				payload.farmArea = Number(editFarmArea) || 0;
				payload.address = editAddress;
			} else if (authState.profile.role === 'customer') {
				payload.address = editAddress;
			}

			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save profile changes');
			}

			const result = await res.json();
			authState.profile = result.profile;
			editing = false;
		} catch (err) {
			console.error('Error saving settings profile:', err);
			saveError = err.message;
		} finally {
			saving = false;
		}
	}

	async function triggerPasswordReset() {
		if (!authState.user?.email) return;
		passwordResetSent = false;
		passwordResetError = '';

		try {
			await sendPasswordResetEmail(auth, authState.user.email);
			passwordResetSent = true;
		} catch (err) {
			console.error('Password reset email error:', err);
			passwordResetError = err.message;
		}
	}

	async function handleDeleteAccount() {
		if (deleteInputEmail !== authState.user?.email) {
			deleteError = 'Email address does not match.';
			return;
		}

		deleting = true;
		deleteError = '';

		try {
			const res = await fetch('/api/profile', {
				method: 'DELETE'
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete account');
			}

			// Clear client auth and redirect to landing
			await logout();
			showDeleteModal = false;
			goto('/');
		} catch (err) {
			console.error('Account deletion error:', err);
			deleteError = err.message;
		} finally {
			deleting = false;
		}
	}

	async function triggerLogout() {
		const confirmed = await showConfirm({
			title: 'Confirm Logout?',
			message: 'Are you sure you want to end your active AgriConnect session? You will need to log back in to review dashboard parameters.',
			confirmText: 'Confirm Logout',
			confirmColor: 'bg-red-600 hover:bg-red-700 text-white'
		});
		if (confirmed) {
			await logout();
			goto('/login');
		}
	}
</script>

<svelte:head>
	<title>Settings & Account Management — AgriConnect</title>
</svelte:head>

<section class="max-w-4xl mx-auto space-y-6">
	<!-- Page Title -->
	<div>
		<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
			<span class="material-symbols-outlined text-primary-green text-3xl">settings</span> Settings & Account Management
		</h1>
		<p class="text-sm text-slate-500 mt-1">Manage your profiles, password security, localization, and system preferences.</p>
	</div>

	<!-- Grid Layout -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		
		<!-- LEFT COLUMN: Profile Details -->
		<div class="space-y-6">
			<!-- Profile Card -->
			<div class="glass-card rounded-2xl p-6 bg-white flex flex-col space-y-5">
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[18px] text-primary-green">person</span>
						Profile Details
					</h3>
					{#if !editing && authState.profile}
						<button 
							onclick={startEditing}
							class="text-xs font-bold text-primary-green hover:underline cursor-pointer flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-[14px]">edit</span>
							Edit Profile
						</button>
					{/if}
				</div>

				{#if authState.profile}
					<!-- Profile Information -->
					<div class="flex items-center gap-4">
						<div class="size-16 rounded-2xl bg-gradient-to-tr from-primary-green to-dark-green flex items-center justify-center text-white font-black text-2xl uppercase shadow-sm">
							{authState.profile.fullName[0]}
						</div>
						<div>
							<h4 class="text-base font-extrabold text-slate-800 leading-none">{authState.profile.fullName}</h4>
							<span class="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-emerald-100/50 bg-emerald-50 text-dark-green uppercase">
								{authState.profile.role}
							</span>
						</div>
					</div>

					{#if !editing}
						<!-- View Mode -->
						<div class="grid grid-cols-1 gap-4 text-xs font-medium text-slate-600">
							<div>
								<span class="block text-[10px] font-bold text-slate-400 uppercase">Full Name</span>
								<p class="mt-1 text-slate-800 font-semibold">{authState.profile.fullName}</p>
							</div>
							<div>
								<span class="block text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
								<p class="mt-1 text-slate-800 font-semibold">{authState.profile.email}</p>
							</div>
							<div>
								<span class="block text-[10px] font-bold text-slate-400 uppercase">Phone Number</span>
								<p class="mt-1 text-slate-800 font-semibold">{authState.profile.phone || 'Not provided'}</p>
							</div>

							{#if authState.profile.role === 'farmer'}
								<div>
									<span class="block text-[10px] font-bold text-slate-400 uppercase">Farm Name</span>
									<p class="mt-1 text-slate-800 font-semibold">{authState.profile.farmName || 'N/A'}</p>
								</div>
								<div>
									<span class="block text-[10px] font-bold text-slate-400 uppercase">Cultivated Area</span>
									<p class="mt-1 text-slate-800 font-semibold">{authState.profile.farmArea || 0} Acres</p>
								</div>
								<div>
									<span class="block text-[10px] font-bold text-slate-400 uppercase">Farm Location Address</span>
									<p class="mt-1 text-slate-800 font-semibold">{authState.profile.address || 'N/A'}</p>
								</div>
							{:else if authState.profile.role === 'customer'}
								<div>
									<span class="block text-[10px] font-bold text-slate-400 uppercase">Shipping Address</span>
									<p class="mt-1 text-slate-800 font-semibold">{authState.profile.address || 'N/A'}</p>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Edit Mode -->
						<div class="space-y-4" transition:slide={{ duration: 150 }}>
							<label class="block">
								<span class="text-[10px] font-bold text-slate-500 uppercase">Full Name</span>
								<input 
									type="text" 
									bind:value={editName}
									class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
								/>
							</label>

							<label class="block opacity-60">
								<span class="text-[10px] font-bold text-slate-500 uppercase">Email Address (Read-only)</span>
								<input 
									type="email" 
									value={authState.profile.email} 
									disabled
									class="mt-1 w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed"
								/>
							</label>

							<label class="block">
								<span class="text-[10px] font-bold text-slate-500 uppercase">Phone Number</span>
								<input 
									type="text" 
									bind:value={editPhone}
									class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
									placeholder="+91 XXXXX XXXXX"
								/>
							</label>

							{#if authState.profile.role === 'farmer'}
								<label class="block">
									<span class="text-[10px] font-bold text-slate-500 uppercase">Farm Name</span>
									<input 
										type="text" 
										bind:value={editFarmName}
										class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
									/>
								</label>
								<label class="block">
									<span class="text-[10px] font-bold text-slate-500 uppercase">Cultivated Area (Acres)</span>
									<input 
										type="number" 
										bind:value={editFarmArea}
										class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
									/>
								</label>
								<label class="block">
									<span class="text-[10px] font-bold text-slate-500 uppercase">Farm Location Address</span>
									<input 
										type="text" 
										bind:value={editAddress}
										class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
									/>
								</label>
							{:else if authState.profile.role === 'customer'}
								<label class="block">
									<span class="text-[10px] font-bold text-slate-500 uppercase">Shipping Address</span>
									<input 
										type="text" 
										bind:value={editAddress}
										class="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-green"
									/>
								</label>
							{/if}

							{#if saveError}
								<p class="text-xs font-bold text-red-650">{saveError}</p>
							{/if}

							<div class="flex gap-3 pt-2">
								<button 
									onclick={() => editing = false} 
									disabled={saving}
									class="btn-secondary flex-1 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
								>
									Cancel
								</button>
								<button 
									onclick={saveProfile} 
									disabled={saving}
									class="btn-primary flex-1 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
								>
									Save Changes
								</button>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- RIGHT COLUMN: Preferences & Security -->
		<div class="space-y-6">
			
			<!-- Preferences Card -->
			<div class="glass-card rounded-2xl p-6 bg-white space-y-4">
				<h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
					<span class="material-symbols-outlined text-[18px] text-primary-green">tune</span>
					Preferences & Localization
				</h3>

				<div class="space-y-3.5 text-xs font-medium text-slate-700">
					<!-- Theme Selector -->
					<div class="flex items-center justify-between">
						<div>
							<span class="block font-bold text-slate-850">Visual Theme</span>
							<p class="text-[10px] text-slate-400 font-semibold mt-0.5">Toggle light, dark, or system matches</p>
						</div>
						<select 
							bind:value={activeTheme} 
							onchange={() => handlePrefChange('theme', activeTheme)}
							class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-green cursor-pointer"
						>
							<option value="light">Light Mode</option>
							<option value="dark">Dark Mode</option>
							<option value="system">System Default</option>
						</select>
					</div>

					<!-- Currency Selector -->
					<div class="flex items-center justify-between">
						<div>
							<span class="block font-bold text-slate-850">Preferred Currency</span>
							<p class="text-[10px] text-slate-400 font-semibold mt-0.5">Used for marketplace listed items</p>
						</div>
						<select 
							bind:value={activeCurrency} 
							onchange={() => handlePrefChange('currency', activeCurrency)}
							class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-green cursor-pointer"
						>
							<option value="INR">INR (₹) - Default</option>
						</select>
					</div>

					<!-- Date Format Selector -->
					<div class="flex items-center justify-between">
						<div>
							<span class="block font-bold text-slate-850">Date Format</span>
							<p class="text-[10px] text-slate-400 font-semibold mt-0.5">Presentation format of logged timestamps</p>
						</div>
						<select 
							bind:value={activeDateFormat} 
							onchange={() => handlePrefChange('date_format', activeDateFormat)}
							class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-green cursor-pointer"
						>
							<option value="DD/MM/YYYY">DD/MM/YYYY</option>
							<option value="MM/DD/YYYY">MM/DD/YYYY</option>
							<option value="YYYY-MM-DD">YYYY-MM-DD</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Security & Account Actions Card -->
			<div class="glass-card rounded-2xl p-6 bg-white space-y-4">
				<h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
					<span class="material-symbols-outlined text-[18px] text-primary-green">security</span>
					Security & Actions
				</h3>

				<div class="space-y-4">
					<!-- Change Password Triggers -->
					<div class="flex items-center justify-between">
						<div>
							<span class="block text-xs font-bold text-slate-800">Change Password</span>
							<p class="text-[10px] text-slate-400 font-semibold mt-0.5">Sends password reset link to your email</p>
						</div>
						<button 
							onclick={triggerPasswordReset}
							class="border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs px-4.5 py-2.5 rounded-lg transition-colors cursor-pointer"
						>
							Reset Password
						</button>
					</div>

					{#if passwordResetSent}
						<p class="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100/50 p-2.5 rounded-lg flex items-center gap-1.5" transition:slide={{ duration: 150 }}>
							<span class="material-symbols-outlined text-[14px]">check_circle</span>
							A reset link has been dispatched to {authState.user?.email}.
						</p>
					{/if}
					{#if passwordResetError}
						<p class="text-[10px] font-bold text-red-650 bg-red-50 border border-red-100/50 p-2.5 rounded-lg" transition:slide={{ duration: 150 }}>
							{passwordResetError}
						</p>
					{/if}

					<!-- Delete Account -->
					<div class="flex items-center justify-between border-t border-slate-100 pt-4">
						<div>
							<span class="block text-xs font-bold text-red-600">Delete Account</span>
							<p class="text-[10px] text-slate-400 font-semibold mt-0.5">Permanently erase profile & access credentials</p>
						</div>
						<button 
							onclick={() => { deleteInputEmail = ''; deleteError = ''; showDeleteModal = true; }}
							class="bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs px-4.5 py-2.5 rounded-lg transition-colors cursor-pointer"
						>
							Delete Account
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- BOTTOM LOGOUT SECTION -->
	<div class="pt-6 border-t border-slate-200/60 flex flex-col items-center">
		<button 
			onclick={triggerLogout}
			class="border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-extrabold text-xs px-7 py-3 rounded-full flex items-center justify-center gap-2 transition-all shadow-sm active:translate-y-0.5 cursor-pointer"
		>
			<span class="material-symbols-outlined text-[18px]">logout</span>
			<span>Log Out Session</span>
		</button>
	</div>


	<!-- Account Deletion Confirmation Dialog Modal -->
	<Modal
		bind:show={showDeleteModal}
		size="sm"
		title="Warning: Permanently Delete Account?"
	>
		<div class="space-y-4">
			<p class="text-xs font-semibold text-slate-550 leading-relaxed">
				This action is **irreversible**. Deleting your account will completely delete your database profile, harvests, listing directory accesses, and login credentials.
			</p>
			
			<label class="block text-left">
				<span class="text-[10px] font-bold text-slate-500 uppercase">To confirm, type your email address: <strong class="text-slate-700 select-all">{authState.user?.email}</strong></span>
				<input 
					type="email" 
					bind:value={deleteInputEmail}
					placeholder="name@company.com"
					class="mt-2 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-red-400"
				/>
			</label>

			{#if deleteError}
				<p class="text-xs font-bold text-red-650 bg-red-50 border border-red-100/50 p-2.5 rounded-lg">{deleteError}</p>
			{/if}
		</div>

		{#snippet footer()}
			<button
				type="button"
				onclick={() => showDeleteModal = false}
				class="btn-secondary flex-1 py-2.5 text-xs cursor-pointer"
				disabled={deleting}
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleDeleteAccount}
				disabled={deleting || deleteInputEmail !== authState.user?.email}
				class="flex-1 py-2.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
			>
				{#if deleting}
					<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
					Deleting…
				{:else}
					Delete Account
				{/if}
			</button>
		{/snippet}
	</Modal>
</section>
