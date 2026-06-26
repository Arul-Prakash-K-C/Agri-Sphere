<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import './layout.css';
	import { authState, startAuthListener } from '$lib/auth.svelte.js';
	import favicon from '$lib/assets/favicon.svg';
	import { logout } from '$lib/firebase-data';

	let { children, data } = $props();

	$effect(() => {
		authState.user = data.user || null;
		authState.profile = data.profile || null;
		authState.loading = false;
	});

	let navItems = $derived.by(() => {
		if (!authState.profile) {
			return [
				{ href: '/login', label: 'Login', icon: 'login' },
				{ href: '/select-role', label: 'Register', icon: 'person_add' }
			];
		}

		const role = authState.profile.role;
		if (role === 'admin') {
			return [
				{ href: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
				{ href: '/admin/tasks', label: 'Task Management', icon: 'assignment' },
				{ href: '/admin/files', label: 'Files Archive', icon: 'folder' }
			];
		}

		if (role === 'farmer') {
			return [
				{ href: '/farmer/dashboard', label: 'Dashboard', icon: 'agriculture' },
				{ href: '/farmer/crops', label: 'Crops', icon: 'psychology' },
				{ href: '/farmer/harvests', label: 'Harvest Logs', icon: 'agriculture' },
				{ href: '/farmer/expenses', label: 'Expenses', icon: 'payments' },
				{ href: '/farmer/irrigation', label: 'Irrigation', icon: 'water_drop' },
				{ href: '/farmer/inventory', label: 'Inventory', icon: 'inventory_2' },
				{ href: '/farmer/disease', label: 'Disease Detection', icon: 'shutter_speed' },
				{ href: '/farmer/products', label: 'My Listings', icon: 'storefront' }
			];
		}

		// customer
		return [
			{ href: '/customer/dashboard', label: 'Dashboard', icon: 'dashboard' }
		];
	});

	onMount(() => {
		startAuthListener();
	});

	async function handleLogout() {
		await logout();
		goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Material Icons Stylesheet -->
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
	<!-- Load Chart.js globally -->
	<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</svelte:head>

<!-- Global container -->
<div class="min-h-screen bg-background-green text-slate-900 font-sans selection:bg-primary-green/20 selection:text-dark-green flex flex-col md:flex-row">
	
	<!-- PORTAL VIEW (If User is Authenticated) -->
	{#if authState.profile}
		<!-- Desktop Left Sidebar -->
		<aside class="glass-sidebar w-64 h-screen fixed left-0 top-0 z-40 hidden md:flex flex-col p-6 space-y-6">
			<div class="flex items-center gap-3 mb-2">
				<img src="/logo.png" alt="AgriConnect Logo" class="size-10 object-contain rounded-full border border-emerald-100/50 shadow-sm" />
				<div>
					<h1 class="font-bold text-lg tracking-tight text-slate-800 leading-none">AgriConnect</h1>
					<span class="text-[10px] text-dark-green font-semibold uppercase tracking-wider mt-1 block">Smart AgriTech</span>
				</div>
			</div>

			<!-- Role indicator -->
			<div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col gap-1">
				<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account Role</span>
				<span class="text-xs font-extrabold text-dark-green capitalize flex items-center gap-1.5">
					<span class="size-1.5 rounded-full bg-primary-green"></span>
					{authState.profile.role}
				</span>
			</div>

			<!-- Nav links -->
			<nav class="flex-1 space-y-1 overflow-y-auto pr-1">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class={[
							'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all-custom',
							page.url.pathname === item.href
								? 'bg-primary-green text-white shadow-md shadow-primary-green/20'
								: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[20px]">{item.icon}</span>
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>

			<!-- Sidebar Footer -->
			<div class="pt-4 border-t border-slate-200/50 space-y-1">
				<div class="px-2 py-2 flex items-center gap-3">
					<!-- User Info -->
					<div class="size-9 rounded-2xl bg-gradient-to-tr from-primary-green to-dark-green flex items-center justify-center text-white font-extrabold text-sm shadow-sm uppercase">
						{authState.profile.fullName[0]}
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-xs font-bold text-slate-800 truncate leading-none">{authState.profile.fullName}</p>
						<p class="text-[9px] text-slate-400 truncate mt-1">{authState.profile.email}</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleLogout}
					class="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all-custom text-left mt-2"
				>
					<span class="material-symbols-outlined text-[20px]">logout</span>
					<span>Logout</span>
				</button>
			</div>
		</aside>

		<!-- Main content frame for Portal -->
		<div class="flex-1 md:ml-64 flex flex-col min-h-screen relative w-full pb-20 md:pb-6">
			<!-- Background Dot Pattern overlay -->
			<div class="absolute inset-0 z-[-1] opacity-[0.03]" style="background-image: radial-gradient(circle at 1px 1px, #15803d 1.5px, transparent 0); background-size: 24px 24px;"></div>
			
			<!-- Portal Header -->
			<header class="bg-white/75 backdrop-blur-md sticky top-0 w-full z-30 border-b border-emerald-100/50 px-6 py-4 flex justify-between items-center">
				<div>
					<h2 class="font-extrabold text-slate-800 text-base md:hidden flex items-center gap-2.5">
						<img src="/logo.png" alt="AgriConnect Logo" class="size-8 object-contain rounded-full border border-emerald-100/50 shadow-sm" />
						AgriConnect
					</h2>
				</div>
				
				<!-- Utility buttons -->
				<div class="flex items-center gap-3">
					<!-- Search bar (desktop) -->
					<div class="relative hidden sm:block">
						<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
						<input 
							type="text" 
							placeholder="Search resources..." 
							class="bg-slate-100/80 border-none rounded-full py-1.5 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-primary-green focus:bg-white w-48 transition-all duration-300 focus:w-56 outline-none"
						/>
					</div>

					<button class="text-slate-500 hover:text-primary-green hover:bg-emerald-50 p-2 rounded-2xl transition-all scale-95 active:scale-90 relative">
						<span class="material-symbols-outlined text-[22px]">notifications</span>
						<span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
					</button>

					<button class="text-slate-500 hover:text-primary-green hover:bg-emerald-50 p-2 rounded-2xl transition-all scale-95 active:scale-90">
						<span class="material-symbols-outlined text-[22px]">settings</span>
					</button>
				</div>
			</header>

			<!-- Content section -->
			<main class="p-6 md:p-10 flex-1 animate-fade-in">
				{@render children()}
			</main>

			<!-- Mobile Bottom Navigation (Visible only on mobile screen widths) -->
			<nav class="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-emerald-100 flex justify-around items-center py-3.5 z-40 shadow-lg">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class={[
							'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
							page.url.pathname === item.href ? 'text-primary-green' : 'text-slate-500'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname === item.href ? '1' : '0'};">{item.icon}</span>
						<span class="text-[9px] mt-0.5 tracking-tight">{item.label}</span>
					</a>
				{/each}
				<button
					type="button"
					onclick={handleLogout}
					class="flex flex-col items-center gap-0.5 text-xs font-bold text-red-500"
				>
					<span class="material-symbols-outlined text-[22px]">logout</span>
					<span class="text-[9px] mt-0.5 tracking-tight">Logout</span>
				</button>
			</nav>
		</div>

	<!-- GUEST VIEW (Welcome screen, Login, Register, Forgot Password) -->
	{:else}
		<div class="flex-grow flex flex-col w-full">
			<header class="border-b border-emerald-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
				<div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
					<a href="/" class="flex items-center gap-3 group">
						<img src="/logo.png" alt="AgriConnect Logo" class="size-10 object-contain rounded-full border border-emerald-100/50 shadow-sm transition-all duration-300 group-hover:scale-105" />
						<span>
							<span class="block text-lg font-bold tracking-tight text-slate-800">AgriConnect</span>
							<span class="block text-xs text-dark-green font-medium -mt-0.5">Smart AgriTech Platform</span>
						</span>
					</a>

					<nav class="flex flex-wrap items-center gap-2">
						{#each navItems as item (item.href)}
							<a
								href={item.href}
								class={[
									'rounded-2xl px-4 py-2 text-sm font-semibold transition-all-custom',
									page.url.pathname === item.href
										? 'bg-primary-green text-white shadow-sm shadow-primary-green/10'
										: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
								].filter(Boolean).join(' ')}
							>
								{item.label}
							</a>
						{/each}
					</nav>
				</div>
			</header>

			<main class="flex-grow flex flex-col justify-center animate-fade-in">
				{@render children()}
			</main>
		</div>
	{/if}
</div>
