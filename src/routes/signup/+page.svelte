<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authState, registerUser } from '$lib/auth.svelte.js';
	import { roleHome } from '$lib/firebase-data';

	// Stepper state: 1, 2, 3
	let currentStep = $state(1);

	// Common form fields
	let fullName = $state('');
	let email = $state('');
	let phone = $state('');
	let password = $state('');
	let confirmPassword = $state('');

	// Farmer specific fields
	let farmName = $state('');
	let farmArea = $state(''); // acres
	let address = $state('');  // For both farmer and customer

	// Admin specific fields
	let adminAccessCode = $state('');

	let loading = $state(false);
	let error = $state('');

	// Extract selected role from URL query param (defaults to 'farmer', converts buyer to customer)
	let roleParam = $derived(page.url.searchParams.get('role') || 'farmer');
	let role = $derived(roleParam === 'buyer' ? 'customer' : roleParam);

	$effect(() => {
		if (!authState.loading && authState.profile) {
			goto(roleHome(authState.profile.role));
		}
	});

	// Simple client-side validators
	let step1Valid = $derived(fullName.trim().length > 0 && email.includes('@') && phone.trim().length >= 8);
	let step2Valid = $derived(password.length >= 6 && password === confirmPassword);
	
	let step3Valid = $derived.by(() => {
		if (role === 'farmer') {
			return farmName.trim().length > 0 && farmArea > 0 && address.trim().length > 0;
		}
		if (role === 'customer') {
			return address.trim().length > 0;
		}
		if (role === 'admin') {
			return adminAccessCode.trim() === 'AGRI-ADMIN-2026';
		}
		return true;
	});

	function nextStep() {
		error = '';
		if (currentStep === 1 && step1Valid) {
			currentStep = 2;
		} else if (currentStep === 2 && step2Valid) {
			currentStep = 3;
		}
	}

	function prevStep() {
		error = '';
		if (currentStep > 1) {
			currentStep -= 1;
		}
	}

	async function submitSignup(event) {
		event.preventDefault();
		if (!step3Valid) {
			if (role === 'admin' && adminAccessCode.trim() !== 'AGRI-ADMIN-2026') {
				error = 'Invalid Admin Access Code. Enter AGRI-ADMIN-2026 for authorization.';
			} else {
				error = 'Please fill in all details correctly.';
			}
			return;
		}

		loading = true;
		error = '';

		try {
			// Construct role specific payload
			let signupPayload = { fullName, email, password, role, phone };
			if (role === 'farmer') {
				signupPayload.farmName = farmName;
				signupPayload.farmArea = farmArea;
				signupPayload.address = address;
			} else if (role === 'customer') {
				signupPayload.address = address;
			} else if (role === 'admin') {
				signupPayload.adminAccessCode = adminAccessCode;
			}

			await registerUser(signupPayload);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	const roleLabels = {
		farmer: 'Farmer 🌱',
		customer: 'Customer 🛒',
		admin: 'Admin ⚙️'
	};
</script>

<svelte:head>
	<title>Sign Up - AgriConnect</title>
</svelte:head>

<section class="mx-auto flex min-h-[85vh] max-w-xl items-center px-4 py-8 sm:px-6">
	<div class="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
		
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-slate-100 pb-5">
			<div>
				<span class="inline-flex items-center gap-1.5 rounded-full bg-light-green px-3 py-1 text-xs font-bold text-dark-green border border-primary-green/20">
					✨ Registering as {roleLabels[role] || 'User'}
				</span>
			</div>
			<a 
				href="/select-role?action=signup" 
				class="text-xs font-bold text-primary-green hover:text-dark-green hover:underline transition-colors"
			>
				Change Role
			</a>
		</div>

		<!-- Progress Stepper -->
		<div class="mt-8 relative flex items-center justify-between w-full mb-8">
			<!-- Stepper progress bar -->
			<div class="absolute left-0 top-1/2 h-0.5 bg-slate-100 w-full -translate-y-1/2 -z-10"></div>
			<div 
				class="absolute left-0 top-1/2 h-0.5 bg-primary-green transition-all duration-300 -translate-y-1/2 -z-10"
				style="width: {(currentStep - 1) * 50}%"
			></div>

			<!-- Step 1 Indicator -->
			<div class="flex flex-col items-center">
				<span 
					class={[
						'size-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border',
						currentStep >= 1 ? 'bg-primary-green text-white border-primary-green' : 'bg-white text-slate-400 border-slate-200'
					].filter(Boolean).join(' ')}
				>
					1
				</span>
				<span class="text-[10px] sm:text-xs font-bold mt-2 text-slate-500">Contact</span>
			</div>

			<!-- Step 2 Indicator -->
			<div class="flex flex-col items-center">
				<span 
					class={[
						'size-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border',
						currentStep >= 2 ? 'bg-primary-green text-white border-primary-green' : 'bg-white text-slate-400 border-slate-200'
					].filter(Boolean).join(' ')}
				>
					2
				</span>
				<span class="text-[10px] sm:text-xs font-bold mt-2 text-slate-500">Password</span>
			</div>

			<!-- Step 3 Indicator -->
			<div class="flex flex-col items-center">
				<span 
					class={[
						'size-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border',
						currentStep >= 3 ? 'bg-primary-green text-white border-primary-green' : 'bg-white text-slate-400 border-slate-200'
					].filter(Boolean).join(' ')}
				>
					3
				</span>
				<span class="text-[10px] sm:text-xs font-bold mt-2 text-slate-500">Details</span>
			</div>
		</div>

		<!-- Step Wizard Form -->
		<form onsubmit={submitSignup} class="space-y-5">
			
			<!-- STEP 1: Account / Contact Information -->
			{#if currentStep === 1}
				<div class="space-y-4 animate-fade-in">
					<h2 class="text-xl font-extrabold text-slate-800">Basic Information</h2>
					<p class="text-xs text-slate-400 -mt-1 font-medium">Please supply your full name and primary contact routes.</p>
					
					<label class="block">
						<span class="text-sm font-semibold text-slate-700">Full Name</span>
						<input
							type="text"
							bind:value={fullName}
							required
							placeholder="Asha Sharma"
							class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						/>
					</label>

					<label class="block">
						<span class="text-sm font-semibold text-slate-700">Email Address</span>
						<input
							type="email"
							bind:value={email}
							required
							placeholder="asha@example.com"
							class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						/>
					</label>

					<label class="block">
						<span class="text-sm font-semibold text-slate-700">Phone Number</span>
						<input
							type="tel"
							bind:value={phone}
							required
							placeholder="+91 98765 43210"
							class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						/>
					</label>
				</div>
			{/if}

			<!-- STEP 2: Password setup -->
			{#if currentStep === 2}
				<div class="space-y-4 animate-fade-in">
					<h2 class="text-xl font-extrabold text-slate-800">Security Credentials</h2>
					<p class="text-xs text-slate-400 -mt-1 font-medium">Establish a strong secret password for protecting your transactions.</p>

					<label class="block">
						<span class="text-sm font-semibold text-slate-700">Password</span>
						<input
							type="password"
							bind:value={password}
							required
							minlength="6"
							placeholder="Min. 6 characters"
							class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						/>
					</label>

					<label class="block">
						<span class="text-sm font-semibold text-slate-700">Confirm Password</span>
						<input
							type="password"
							bind:value={confirmPassword}
							required
							minlength="6"
							placeholder="Repeat password"
							class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						/>
					</label>

					{#if password && confirmPassword && password !== confirmPassword}
						<p class="text-xs font-semibold text-red-500">❌ Passwords do not match yet.</p>
					{:else if password && confirmPassword && password === confirmPassword}
						<p class="text-xs font-semibold text-primary-green">✓ Passwords match successfully.</p>
					{/if}
				</div>
			{/if}

			<!-- STEP 3: Role-specific details -->
			{#if currentStep === 3}
				<div class="space-y-4 animate-fade-in">
					<h2 class="text-xl font-extrabold text-slate-800">Professional Details</h2>
					<p class="text-xs text-slate-400 -mt-1 font-medium">Fill in setup information required for the {role} workspace profile.</p>

					<!-- Farmer Conditional Form -->
					{#if role === 'farmer'}
						<label class="block">
							<span class="text-sm font-semibold text-slate-700">Farm Name</span>
							<input
								type="text"
								bind:value={farmName}
								required
								placeholder="Green Valley Organics"
								class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
							/>
						</label>

						<label class="block">
							<span class="text-sm font-semibold text-slate-700">Farm Area Size (Acres)</span>
							<input
								type="number"
								min="1"
								bind:value={farmArea}
								required
								placeholder="e.g. 15"
								class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
							/>
						</label>

						<label class="block">
							<span class="text-sm font-semibold text-slate-700">Farm Address</span>
							<textarea
								bind:value={address}
								required
								rows="3"
								placeholder="Rural Sector 4A, Green Valley Village"
								class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
							></textarea>
						</label>
					{/if}

					<!-- Customer Conditional Form -->
					{#if role === 'customer'}
						<label class="block">
							<span class="text-sm font-semibold text-slate-700">Delivery / Shipping Address</span>
							<textarea
								bind:value={address}
								required
								rows="4"
								placeholder="Warehouse 92, Industrial Trade Loop, City Center"
								class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
							></textarea>
						</label>
					{/if}

					<!-- Admin Conditional Form -->
					{#if role === 'admin'}
						<label class="block">
							<span class="text-sm font-semibold text-slate-700">Admin Access Code</span>
							<input
								type="password"
								bind:value={adminAccessCode}
								required
								placeholder="Enter code (Hint: AGRI-ADMIN-2026)"
								class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
							/>
						</label>

						<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
							⚠️ <strong>Authorized Only:</strong> Accessing Admin workspace requires standard code validation. Unauthorized accounts will be suspended.
						</div>
					{/if}
				</div>
			{/if}

			{#if error}
				<div class="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fade-in">
					⚠️ {error}
				</div>
			{/if}

			<!-- Button Controls -->
			<div class="flex items-center gap-3 pt-4 border-t border-slate-100">
				{#if currentStep > 1}
					<button
						type="button"
						onclick={prevStep}
						class="w-1/3 rounded-2xl border border-slate-200 bg-white py-3.5 font-semibold text-slate-700 hover:bg-slate-50 transition-all-custom"
					>
						Back
					</button>
				{/if}

				{#if currentStep < 3}
					<button
						type="button"
						onclick={nextStep}
						disabled={currentStep === 1 ? !step1Valid : !step2Valid}
						class="flex-grow rounded-2xl bg-primary-green py-3.5 font-semibold text-white shadow-lg shadow-primary-green/10 hover:bg-dark-green hover:scale-[1.01] transition-all-custom disabled:cursor-not-allowed disabled:opacity-60"
					>
						Continue
					</button>
				{:else}
					<button
						type="submit"
						disabled={loading || !step3Valid}
						class="flex-grow rounded-2xl bg-gradient-to-br from-primary-green to-dark-green py-3.5 font-semibold text-white shadow-lg shadow-primary-green/20 hover:shadow-primary-green/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? 'Creating workspace...' : 'Submit & Register'}
					</button>
				{/if}
			</div>
		</form>

		<p class="mt-8 text-center text-sm text-slate-500 font-medium">
			Already registered?
			<a href="/login" class="font-semibold text-primary-green hover:text-dark-green hover:underline">
				Login here
			</a>
		</p>
	</div>
</section>
