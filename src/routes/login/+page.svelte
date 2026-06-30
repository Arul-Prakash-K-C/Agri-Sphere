<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte.js';
	import { roleHome } from '$lib/firebase-data';
	import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import Silk from '$lib/components/Silk.svelte';

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

<section class="h-full w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
	<!-- Split Layout Container inside screen boundaries, subtracting the layout header height (approx 57px) -->
	<div class="grid w-full max-w-5xl h-full max-h-[calc(100vh-57px-4rem)] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl md:grid-cols-2">
		
		<!-- Left Side: Farming Illustration -->
		<div class="relative hidden flex-col justify-between p-8 text-white md:flex bg-dark-green overflow-hidden">
			<!-- Silk Background using primary website green -->
			<div class="absolute inset-0 z-0 select-none pointer-events-none">
				<Silk color="#006b2c" speed={3} scale={1.5} noiseIntensity={1.2} />
			</div>

			<div class="space-y-1 relative z-10">
				<div class="flex items-center gap-3">
					<img src="/logo.png" alt="AgriConnect Logo" class="size-10 object-contain rounded-full border border-emerald-100/50 shadow-sm bg-white" />
					<span class="text-lg font-bold tracking-tight">AgriConnect</span>
				</div>
				<p class="text-xs text-white/70">Connecting Growers & Traders Digitally</p>
			</div>

			<!-- Core Illustration — Animated Tractor -->
			<div class="my-auto flex items-center justify-center relative z-10 max-h-[220px]">
				<svg viewBox="0 0 400 310" class="w-full max-w-[270px]" fill="none" xmlns="http://www.w3.org/2000/svg">
					<style>
						@keyframes spin {
							0% { transform: rotate(0deg); }
							100% { transform: rotate(360deg); }
						}
						@keyframes dust-drift {
							0% {
								transform: translate(0, 0) scale(0.6);
								opacity: 0;
							}
							15% {
								opacity: 0.7;
							}
							100% {
								transform: translate(-45px, -15px) scale(1.6);
								opacity: 0;
							}
						}
						.spin-wheel {
							animation: spin 1.2s linear infinite;
							transform-origin: center;
						}
						.dust-particle {
							animation: dust-drift 1.8s infinite linear;
						}
						.d-1 { animation-delay: 0s; }
						.d-2 { animation-delay: 0.4s; }
						.d-3 { animation-delay: 0.8s; }
						.d-4 { animation-delay: 1.2s; }
					</style>
					<defs>
						<linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stop-color="#34d399" />
							<stop offset="60%" stop-color="#10b981" />
							<stop offset="100%" stop-color="#047857" />
						</linearGradient>
						<linearGradient id="cabGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
							<stop offset="100%" stop-color="#ffffff" stop-opacity="0.03" />
						</linearGradient>
						<radialGradient id="tractorGlow" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
							<stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
						</radialGradient>
						<filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
							<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#021a0e" flood-opacity="0.5"/>
						</filter>
					</defs>

					<!-- Ambient background glow -->
					<circle cx="200" cy="155" r="95" fill="url(#tractorGlow)"/>

					<!-- Ground / Soil line -->
					<path d="M 60 235 Q 200 232 340 235" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>

					<!-- Flying Dust Particles (Behind rear wheel) -->
					<!-- Center of giant rear wheel is at (140, 180) -->
					<g class="dust-particle d-1" style="transform-origin: 80px 220px;">
						<circle cx="80" cy="220" r="10" fill="#10b981" opacity="0.3" filter="blur(2px)" />
					</g>
					<g class="dust-particle d-2" style="transform-origin: 75px 224px;">
						<circle cx="75" cy="224" r="14" fill="#34d399" opacity="0.25" filter="blur(3.5px)" />
					</g>
					<g class="dust-particle d-3" style="transform-origin: 82px 216px;">
						<circle cx="82" cy="216" r="8" fill="#a7f3d0" opacity="0.35" filter="blur(1.5px)" />
					</g>
					<g class="dust-particle d-4" style="transform-origin: 70px 226px;">
						<circle cx="70" cy="226" r="16" fill="#10b981" opacity="0.2" filter="blur(4px)" />
					</g>

					<!-- TRACTOR BODY GROUP -->
					<g filter="url(#shadow)">
						<!-- Cab / Glass Greenhouse Roof (Shifted back and elevated high) -->
						<path d="M 112 135 L 125 70 L 180 70 L 175 135 Z" fill="url(#cabGrad)" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.4"/>
						<!-- Cab Interior Seat / Controls silhouette -->
						<path d="M 125 135 L 132 108 L 148 108 L 152 135" fill="#047857" opacity="0.6"/>
						
						<!-- Main Engine Body / Chassis (High rear, sloping/dropping sharply to front) -->
						<path d="M 98 135 H 265 V 195 H 98 Z" fill="url(#bodyGrad)" stroke="#34d399" stroke-width="1"/>
						<!-- Low Front Engine Hood (Drops sharply from cab height) -->
						<path d="M 175 135 L 265 155 V 195 H 175 Z" fill="#34d399" opacity="0.45"/>
						<!-- Front Grill (Distinct vertical front block) -->
						<path d="M 265 155 L 268 156 V 193 L 265 195 Z" fill="#022c22"/>
						<!-- Front Headlight (Glow effect) -->
						<path d="M 268 160 L 278 162 L 278 170 L 268 170 Z" fill="#a7f3d0"/>
						<polygon points="278,162 335,150 335,195 278,170" fill="#a7f3d0" opacity="0.12"/>
						
						<!-- Exhaust Pipe / Smokestack (Tall vertical pipe on hood) -->
						<path d="M 225 145 V 95 H 229 V 145 Z" fill="#022c22"/>
						<path d="M 225 95 L 222 88 H 232 L 229 95 Z" fill="#022c22"/>

						<!-- Rear Mudguard / Fender (Large curved mudguard enclosing the huge rear wheel) -->
						<path d="M 80 185 C 80 120 125 110 185 125" stroke="url(#bodyGrad)" stroke-width="9" stroke-linecap="round" fill="none"/>
						<!-- Front Mudguard / Fender (Small mudguard for small front wheel) -->
						<path d="M 252 195 C 252 170 274 165 298 172" stroke="url(#bodyGrad)" stroke-width="5" stroke-linecap="round" fill="none"/>
					</g>

					<!-- ROTATING GIANT REAR WHEEL (Center: 135, 180, Radius: 50) -->
					<g class="spin-wheel" style="transform-origin: 135px 180px;">
						<!-- Outer Heavy Tire -->
						<circle cx="135" cy="180" r="50" fill="#022c22" stroke="#34d399" stroke-width="2.5" />
						<!-- Large Tractor Tire Tread Spokes -->
						<line x1="135" y1="130" x2="135" y2="230" stroke="#10b981" stroke-width="4.5" />
						<line x1="85" y1="180" x2="185" y2="180" stroke="#10b981" stroke-width="4.5" />
						<line x1="100" y1="145" x2="170" y2="215" stroke="#10b981" stroke-width="3.5" />
						<line x1="100" y1="215" x2="170" y2="145" stroke="#10b981" stroke-width="3.5" />
						<line x1="110" y1="135" x2="160" y2="225" stroke="#10b981" stroke-width="2" />
						<line x1="110" y1="225" x2="160" y2="135" stroke="#10b981" stroke-width="2" />
						<!-- Inner Wheel Rim -->
						<circle cx="135" cy="180" r="30" fill="#047857" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.5" />
						<circle cx="135" cy="180" r="18" fill="#10b981" />
						<!-- Center Hub -->
						<circle cx="135" cy="180" r="7" fill="#ffffff" />
					</g>

					<!-- ROTATING SMALL FRONT WHEEL (Center: 275, 208, Radius: 22) -->
					<g class="spin-wheel" style="transform-origin: 275px 208px;">
						<!-- Outer Tire -->
						<circle cx="275" cy="208" r="22" fill="#022c22" stroke="#34d399" stroke-width="1.2" />
						<!-- Spokes -->
						<line x1="275" y1="186" x2="275" y2="230" stroke="#10b981" stroke-width="2" />
						<line x1="253" y1="208" x2="297" y2="208" stroke="#10b981" stroke-width="2" />
						<line x1="259" y1="192" x2="291" y2="224" stroke="#10b981" stroke-width="1.5" />
						<line x1="259" y1="224" x2="291" y2="192" stroke="#10b981" stroke-width="1.5" />
						<!-- Rim -->
						<circle cx="275" cy="208" r="12" fill="#047857" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.5" />
						<circle cx="275" cy="208" r="7" fill="#10b981" />
						<!-- Hub -->
						<circle cx="275" cy="208" r="3" fill="#ffffff" />
					</g>
				</svg>
			</div>



			<div class="space-y-1 relative z-10">
				<p class="text-sm font-semibold">{currentMeta.label} Portal</p>
				<p class="text-xs text-emerald-100/80 leading-relaxed">{currentMeta.desc}</p>
			</div>
		</div>

		<!-- Right Side: Login Card with scrolling content only if height is very small -->
		<div class="flex flex-col justify-center px-6 py-6 sm:px-10 overflow-y-auto bg-white">
			<div>
				<h2 class="text-2xl font-extrabold tracking-tight text-slate-900">Welcome Back</h2>
				<p class="text-slate-500 text-xs mt-0.5">Please log in to manage your AgriConnect features.</p>
			</div>

			<form class="mt-5 space-y-3.5" onsubmit={submitLogin}>
				<label class="block">
					<span class="text-xs font-semibold text-slate-700">Email Address</span>
					<input
						type="email"
						bind:value={email}
						required
						class="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200 text-sm"
						placeholder="name@company.com"
					/>
				</label>

				<label class="block">
					<span class="text-xs font-semibold text-slate-700">Password</span>
					<input
						type="password"
						bind:value={password}
						required
						class="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200 text-sm"
						placeholder="••••••••"
					/>
				</label>

				<!-- Remember Me & Forgot Password -->
				<div class="flex items-center justify-between text-xs pt-0.5">
					<label class="flex items-center gap-1.5 cursor-pointer select-none">
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
					<div class="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
						⚠️ {error}
					</div>
				{/if}

				<!-- Actions -->
				<div class="pt-2 space-y-3">
					<button
						type="submit"
						disabled={loading}
						class="w-full h-11 rounded-xl bg-gradient-to-br from-primary-green to-dark-green font-semibold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
					>
						{loading ? 'Authenticating...' : 'Sign In'}
					</button>

					<div class="relative flex py-1.5 items-center">
						<div class="grow border-t border-slate-100"></div>
						<span class="shrink mx-3 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">or</span>
						<div class="grow border-t border-slate-100"></div>
					</div>

					<button
						type="button"
						onclick={submitGoogleLogin}
						disabled={loading}
						class="flex w-full h-11 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm text-sm"
					>
						<!-- Google Vector Icon -->
						<svg class="size-4.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
							<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
							<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
							<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
						</svg>
						Continue with Google
					</button>
				</div>
			</form>

			<p class="mt-6 text-center text-xs text-slate-500 font-medium">
				New to AgriConnect?
				<a href="/select-role?action=signup" class="font-bold text-primary-green hover:text-dark-green hover:underline">
					Create an account
				</a>
			</p>
		</div>
	</div>
</section>
