<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte.js';
	import { roleHome } from '$lib/firebase-data';
	import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
	import { auth } from '$lib/firebase';

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let loading = $state(false);
	let error = $state('');

	// Get role from query parameter or default to 'farmer'
	let roleParam = $derived(page.url.searchParams.get('role') || 'farmer');
	let role = $derived(roleParam === 'buyer' ? 'customer' : roleParam);

	$effect(() => {
		if (!authState.loading && authState.profile) {
			goto(roleHome(authState.profile.role));
		}
	});

	async function submitLogin(event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			await signInWithEmailAndPassword(auth, email, password);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function submitGoogleLogin() {
		loading = true;
		error = '';

		try {
			const provider = new GoogleAuthProvider();
			await signInWithPopup(auth, provider);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Dynamic descriptive text based on role
	const roleMeta = {
		farmer: { label: 'Farmer 🌱', desc: 'Manage your harvests, list produce, and view direct buyers.' },
		customer: { label: 'Customer 🛒', desc: 'Browse fresh yields, manage orders, and connect with direct growers.' },
		admin: { label: 'Admin ⚙️', desc: 'Platform settings, access verification, and user management.' }
	};
	let currentMeta = $derived(roleMeta[role] || roleMeta['farmer']);
</script>

<svelte:head>
	<title>Login - AgriConnect</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-16">
	<!-- Split Layout Container -->
	<div class="grid min-h-150 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl md:grid-cols-2">
		
		<!-- Left Side: Farming Illustration -->
		<div class="relative hidden flex-col justify-between bg-linear-to-tr from-primary-green/90 to-dark-green p-10 text-white md:flex">
			<div class="space-y-2">
				<div class="flex items-center gap-3">
					<img src="/logo.png" alt="AgriConnect Logo" class="size-11 object-contain rounded-full border border-emerald-100/50 shadow-sm bg-white" />
					<span class="text-xl font-bold tracking-tight">AgriConnect</span>
				</div>
				<p class="text-sm text-white/70">Connecting Growers & Traders Digitally</p>
			</div>

			<!-- Core Illustration -->
			<div class="my-auto flex items-center justify-center">
				<svg viewBox="0 0 400 300" class="w-full max-w-[320px] drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
					<!-- Tractor & Crop Vector -->
					<path d="M50 250 L350 250" stroke="#FFFFFF" stroke-width="4" opacity="0.3" stroke-linecap="round" />
					<path d="M100 250 C120 200 280 200 300 250 Z" fill="#FFFFFF" opacity="0.1" />
					
					<!-- Tractor Shape -->
					<rect x="180" y="160" width="80" height="50" rx="6" fill="#FFFFFF" opacity="0.9" />
					<rect x="210" y="120" width="40" height="40" rx="4" fill="#FFFFFF" opacity="0.9" />
					<!-- Cabin window -->
					<rect x="216" y="126" width="28" height="28" rx="2" fill="#15803D" />
					<!-- Engine chimney -->
					<line x1="255" y1="160" x2="255" y2="130" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
					<!-- Tractor Wheels -->
					<circle cx="195" cy="215" r="22" fill="#15803D" stroke="#FFFFFF" stroke-width="4" />
					<circle cx="195" cy="215" r="10" fill="#FFFFFF" />
					<circle cx="250" cy="222" r="15" fill="#15803D" stroke="#FFFFFF" stroke-width="3" />
					<circle cx="250" cy="222" r="6" fill="#FFFFFF" />

					<!-- Little plants along the path -->
					<g transform="translate(80, 235)">
						<path d="M0 15 Q-5 5 2 0 Q2 10 0 15 Z" fill="#FFFFFF" opacity="0.8" />
						<path d="M0 15 Q5 5 7 2 Q3 12 0 15 Z" fill="#FFFFFF" />
					</g>
					<g transform="translate(130, 238) scale(0.8)">
						<path d="M0 15 Q-5 5 2 0 Q2 10 0 15 Z" fill="#FFFFFF" opacity="0.8" />
						<path d="M0 15 Q5 5 7 2 Q3 12 0 15 Z" fill="#FFFFFF" />
					</g>
					<g transform="translate(290, 235)">
						<path d="M0 15 Q-5 5 2 0 Q2 10 0 15 Z" fill="#FFFFFF" opacity="0.8" />
						<path d="M0 15 Q5 5 7 2 Q3 12 0 15 Z" fill="#FFFFFF" />
					</g>
				</svg>
			</div>

			<div class="space-y-1">
				<p class="text-base font-semibold">{currentMeta.label} Portal</p>
				<p class="text-xs text-emerald-100/80 leading-relaxed">{currentMeta.desc}</p>
			</div>
		</div>

		<!-- Right Side: Login Card -->
		<div class="flex flex-col justify-center p-8 sm:p-12 bg-white">
			<div class="mt-8 space-y-2">
				<h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Welcome Back</h2>
				<p class="text-slate-500 text-sm">Please log in to manage your AgriConnect features.</p>
			</div>

			<form class="mt-8 space-y-4" onsubmit={submitLogin}>
				<label class="block">
					<span class="text-sm font-semibold text-slate-700">Email Address</span>
					<input
						type="email"
						bind:value={email}
						required
						class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						placeholder="name@company.com"
					/>
				</label>

				<label class="block">
					<span class="text-sm font-semibold text-slate-700">Password</span>
					<input
						type="password"
						bind:value={password}
						required
						class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
						placeholder="••••••••"
					/>
				</label>

				<!-- Remember Me & Forgot Password -->
				<div class="flex items-center justify-between text-sm">
					<label class="flex items-center gap-2 cursor-pointer select-none">
						<input
							type="checkbox"
							bind:checked={rememberMe}
							class="rounded text-primary-green focus:ring-primary-green/30"
						/>
						<span class="text-slate-600 font-medium">Remember me</span>
					</label>
					<a href="/forgot-password" class="font-semibold text-primary-green hover:text-dark-green hover:underline transition-colors">
						Forgot password?
					</a>
				</div>

				{#if error}
					<div class="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fade-in">
						⚠️ {error}
					</div>
				{/if}

				<!-- Actions -->
				<div class="pt-2 space-y-3">
					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-2xl bg-linear-to-br from-primary-green to-dark-green py-3.5 font-semibold text-white shadow-lg shadow-primary-green/20 hover:shadow-primary-green/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? 'Authenticating...' : 'Sign In'}
					</button>

					<div class="relative flex py-2 items-center">
						<div class="grow border-t border-slate-200"></div>
						<span class="shrink mx-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">or</span>
						<div class="grow border-t border-slate-200"></div>
					</div>

					<button
						type="button"
						onclick={submitGoogleLogin}
						disabled={loading}
						class="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-800 hover:bg-slate-50 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
					>
						<!-- Google Vector Icon -->
						<svg class="size-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
							<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
							<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
							<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
						</svg>
						Continue with Google
					</button>
				</div>
			</form>

			<p class="mt-8 text-center text-sm text-slate-500 font-medium">
				New to AgriConnect?
				<a href="/select-role?action=signup" class="font-semibold text-primary-green hover:text-dark-green hover:underline">
					Create an account
				</a>
			</p>
		</div>
	</div>
</section>
