<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { navigating } from '$app/stores';
	import './layout.css';
	import { authState, startAuthListener } from '$lib/auth.svelte.js';
	import favicon from '$lib/assets/favicon.svg';
	import { logout } from '$lib/firebase-data';
	import Modal from '$lib/components/Modal.svelte';
	import { modalState } from '$lib/modal.svelte.js';

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
				{ href: '/admin/verification', label: 'Verification', icon: 'verified_user' }
			];
		}

		if (role === 'farmer') {
			return [
				{ href: '/farmer/dashboard', label: 'Dashboard', icon: 'agriculture' },
				{ href: '/farmer/irrigation', label: 'Irrigation', icon: 'water_drop' },
				{ href: '/farmer/disease', label: 'Disease Detection', icon: 'shutter_speed' },
				{ href: '/farmer/crops', label: 'Crops', icon: 'psychology' },
				{ href: '/farmer/harvests', label: 'Harvest Logs', icon: 'agriculture' },
				{ href: '/farmer/expenses', label: 'Expenses', icon: 'payments' },
				{ href: '/farmer/inventory', label: 'Inventory', icon: 'inventory_2' },
				{ href: '/farmer/sales', label: 'Sales', icon: 'point_of_sale' },
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

	// Notifications state
	let notifications = $state([]);
	let showNotifications = $state(false);
	let unreadCount = $derived(notifications.filter(n => !n.read).length);

	$effect(() => {
		if (authState.user) {
			fetchNotifications();
		} else {
			notifications = [];
		}
	});

	async function fetchNotifications() {
		try {
			const res = await fetch('/api/notifications');
			if (res.ok) {
				notifications = await res.json();
			}
		} catch (e) {
			console.error('Error fetching notifications:', e);
		}
	}

	async function markAsRead(id) {
		try {
			const res = await fetch('/api/notifications', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, read: true })
			});
			if (res.ok) {
				notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
			}
		} catch (e) {
			console.error('Error marking notification as read:', e);
		}
	}

	function toggleNotificationsDropdown() {
		showNotifications = !showNotifications;
	}

	// Dropup states for mobile navigation menu
	let cropsDropupOpen = $state(false);
	let salesDropupOpen = $state(false);

	function toggleCropsDropup() {
		cropsDropupOpen = !cropsDropupOpen;
		salesDropupOpen = false;
	}

	function toggleSalesDropup() {
		salesDropupOpen = !salesDropupOpen;
		cropsDropupOpen = false;
	}

	function closeDropups() {
		cropsDropupOpen = false;
		salesDropupOpen = false;
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
					<!-- Listens to inputs to dynamically filter results across page routes or redirects -->
					<div class="relative hidden sm:block">
						<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
						<input 
							type="text" 
							placeholder="Search resources..." 
							value={page.url.searchParams.get('search') || ''}
							oninput={(e) => {
								const val = e.target.value;
								const url = new URL(window.location.href);
								if (val.trim()) {
									url.searchParams.set('search', val);
								} else {
									url.searchParams.delete('search');
								}
								// Replace state or navigate to search
								goto(url.toString(), { replaceState: true, keepFocus: true });
							}}
							class="bg-slate-100/80 border-none rounded-full py-1.5 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-primary-green focus:bg-white w-48 transition-all duration-300 focus:w-56 outline-none"
						/>
					</div>

					<div class="relative">
						<button 
							onclick={toggleNotificationsDropdown}
							class="text-slate-500 hover:text-primary-green hover:bg-emerald-50 p-2 rounded-2xl transition-all scale-95 active:scale-90 relative cursor-pointer"
						>
							<span class="material-symbols-outlined text-[22px]">notifications</span>
							{#if unreadCount > 0}
								<span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
							{/if}
						</button>

						{#if showNotifications}
							<!-- Notifications Dropdown Dialog -->
							<div class="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 text-xs text-slate-700 animate-fade-in">
								<div class="flex justify-between items-center border-b border-slate-100 pb-2">
									<span class="font-extrabold text-slate-800">Notifications</span>
									{#if unreadCount > 0}
										<span class="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{unreadCount} New</span>
									{/if}
								</div>
								<div class="max-h-60 overflow-y-auto space-y-2.5 pr-1">
									{#each notifications.slice(0, 5) as item}
										<div class={['p-2.5 rounded-xl border flex flex-col gap-1 transition-colors', item.read ? 'bg-slate-50 border-slate-100 text-slate-450 font-normal' : 'bg-emerald-50/30 border-emerald-100/50 text-slate-850 font-bold'].join(' ')}>
											<div class="flex justify-between items-start gap-2">
												<span class="font-black truncate text-[11px] text-slate-800">{item.title}</span>
												{#if !item.read}
													<button onclick={() => markAsRead(item.id)} class="text-[9px] text-primary-green hover:underline shrink-0 font-bold cursor-pointer">Mark read</button>
												{/if}
											</div>
											<p class="text-[10px] leading-relaxed text-slate-500 font-medium">{item.message}</p>
										</div>
									{:else}
										<div class="text-center text-slate-400 py-6 font-medium">
											<span class="material-symbols-outlined text-2xl text-slate-350 block">notifications_off</span>
											<p class="mt-1">No notifications yet.</p>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<button class="text-slate-500 hover:text-primary-green hover:bg-emerald-50 p-2 rounded-2xl transition-all scale-95 active:scale-90">
						<span class="material-symbols-outlined text-[22px]">settings</span>
					</button>
				</div>
			</header>

			<!-- Content section -->
			<main class="p-6 md:p-10 flex-1">
				{#if $navigating}
					{@const targetPath = $navigating.to?.url?.pathname || ''}
					{#if targetPath.includes('/farmer/crops')}
						<!-- Crops specific page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-48 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
								<div class="skeleton h-10 w-36 rounded-full shrink-0"></div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{#each Array(3) as _}
									<div class="bg-white rounded-2xl border border-slate-200/50 p-5 space-y-4">
										<div class="skeleton h-48 w-full rounded-xl"></div>
										<div class="flex justify-between items-center text-xs">
											<div class="skeleton h-5 w-24 rounded-full"></div>
											<div class="skeleton h-4 w-28 rounded"></div>
										</div>
										<div class="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
											<div class="skeleton h-14 w-14 rounded-full shrink-0"></div>
											<div class="space-y-2 flex-1">
												<div class="skeleton h-3.5 w-1/2 rounded"></div>
												<div class="skeleton h-4.5 w-1/3 rounded"></div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else if targetPath.includes('/farmer/irrigation')}
						<!-- Irrigation specific calendar page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-52 rounded-xl"></div>
									<div class="skeleton h-4.5 w-64 rounded-lg"></div>
								</div>
								<div class="skeleton h-10 w-48 rounded-full shrink-0"></div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
								<div class="skeleton h-24 w-full rounded-2xl"></div>
								<div class="skeleton h-24 w-full rounded-2xl"></div>
								<div class="skeleton h-24 w-full rounded-2xl"></div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
								<div class="lg:col-span-8 bg-white border border-slate-200/50 rounded-2xl p-6 space-y-4">
									<div class="flex justify-between items-center mb-4">
										<div class="skeleton h-6 w-32 rounded"></div>
										<div class="flex gap-2">
											<div class="skeleton h-8 w-8 rounded"></div>
											<div class="skeleton h-8 w-8 rounded"></div>
										</div>
									</div>
									<div class="grid grid-cols-7 gap-2">
										{#each Array(35) as _}
											<div class="skeleton h-14 w-full rounded-xl"></div>
										{/each}
									</div>
								</div>
								<div class="lg:col-span-4 space-y-6">
									<div class="skeleton h-44 w-full rounded-2xl"></div>
									<div class="skeleton h-60 w-full rounded-2xl bg-slate-200/50"></div>
									<div class="skeleton h-64 w-full rounded-2xl"></div>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/expenses')}
						<!-- Expenses specific table logs page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-44 rounded-xl"></div>
									<div class="skeleton h-4 w-80 rounded-lg"></div>
								</div>
								<div class="skeleton h-10 w-36 rounded-full shrink-0"></div>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
								{#each Array(4) as _}
									<div class="bg-white rounded-2xl border border-slate-200/50 p-5 flex items-center gap-4">
										<div class="skeleton h-12 w-12 rounded-xl shrink-0"></div>
										<div class="space-y-2 flex-1">
											<div class="skeleton h-3 w-1/2 rounded"></div>
											<div class="skeleton h-5 w-2/3 rounded"></div>
										</div>
									</div>
								{/each}
							</div>
							<div class="bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4">
								<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
									<div class="skeleton h-8 w-48 rounded-lg"></div>
									<div class="flex gap-2">
										<div class="skeleton h-6 w-16 rounded-full"></div>
										<div class="skeleton h-6 w-16 rounded-full"></div>
										<div class="skeleton h-6 w-16 rounded-full"></div>
									</div>
								</div>
								<div class="overflow-x-auto pt-4 border-t border-slate-100">
									<table class="w-full text-left border-collapse text-xs">
										<thead>
											<tr class="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
												<th class="p-4 pl-6">Date</th>
												<th class="p-4">Category</th>
												<th class="p-4">Description</th>
												<th class="p-4">Amount</th>
												<th class="p-4">Status</th>
												<th class="p-4 pr-6 text-center">Actions</th>
											</tr>
										</thead>
										<tbody>
											{#each Array(5) as _}
												<tr class="border-b border-slate-50">
													<td class="p-4 pl-6"><div class="skeleton h-4 w-20 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-24 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-40 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-16 rounded-full"></div></td>
													<td class="p-4 pr-6 text-center"><div class="skeleton h-4 w-14 rounded mx-auto"></div></td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/harvests')}
						<!-- Harvest logs register page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-44 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
								<div class="skeleton h-10 w-40 rounded-full shrink-0"></div>
							</div>
							<div class="bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4">
								<div class="flex justify-between items-center">
									<div class="skeleton h-8 w-48 rounded-lg"></div>
									<div class="skeleton h-6 w-20 rounded-full"></div>
								</div>
								<div class="overflow-x-auto pt-4 border-t border-slate-100">
									<table class="w-full text-left border-collapse text-xs">
										<thead>
											<tr class="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
												<th class="p-4 pl-6">Crop Name</th>
												<th class="p-4">Harvest Date</th>
												<th class="p-4">Quantity</th>
												<th class="p-4">Quality Grade</th>
												<th class="p-4 pr-6">Notes</th>
											</tr>
										</thead>
										<tbody>
											{#each Array(5) as _}
												<tr class="border-b border-slate-50">
													<td class="p-4 pl-6"><div class="skeleton h-4 w-32 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-20 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
													<td class="p-4"><div class="skeleton h-4 w-20 rounded-full"></div></td>
													<td class="p-4 pr-6"><div class="skeleton h-4 w-40 rounded"></div></td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/inventory')}
						<!-- Inventory register page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-52 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
								<div class="flex gap-2">
									<div class="skeleton h-10 w-36 rounded-full shrink-0"></div>
									<div class="skeleton h-10 w-32 rounded-full shrink-0"></div>
								</div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
								<div class="lg:col-span-4 space-y-6">
									<div class="bg-white rounded-2xl border border-slate-200/50 p-6 space-y-5">
										<div class="skeleton h-6 w-32 rounded"></div>
										<div class="space-y-3">
											{#each Array(2) as _}
												<div class="skeleton h-16 w-full rounded-xl"></div>
											{/each}
										</div>
									</div>
									<div class="bg-white rounded-2xl border border-slate-200/50 p-6 space-y-5">
										<div class="skeleton h-6 w-40 rounded"></div>
										<div class="space-y-4">
											{#each Array(3) as _}
												<div class="skeleton h-10 w-full rounded-xl"></div>
											{/each}
										</div>
									</div>
								</div>
								<div class="lg:col-span-8 bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4">
									<div class="flex justify-between items-center">
										<div class="skeleton h-8 w-44 rounded-lg"></div>
										<div class="flex gap-2">
											{#each Array(4) as _}
												<div class="skeleton h-7 w-12 rounded-full"></div>
											{/each}
										</div>
									</div>
									<div class="overflow-x-auto pt-4 border-t border-slate-100">
										<table class="w-full text-left border-collapse text-xs">
											<thead>
												<tr class="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
													<th class="p-4 pl-6">Product Name</th>
													<th class="p-4">Category</th>
													<th class="p-4 text-right">Total Stock</th>
													<th class="p-4 text-right">Sold/Used</th>
													<th class="p-4 text-right">Available</th>
													<th class="p-4 pr-6 text-center">Status</th>
												</tr>
											</thead>
											<tbody>
												{#each Array(5) as _}
													<tr class="border-b border-slate-50">
														<td class="p-4 pl-6">
															<div class="flex items-center gap-3">
																<div class="skeleton h-8 w-8 rounded-lg shrink-0"></div>
																<div class="skeleton h-4 w-28 rounded"></div>
															</div>
														</td>
														<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
														<td class="p-4 text-right"><div class="skeleton h-4 w-14 rounded ml-auto"></div></td>
														<td class="p-4 text-right"><div class="skeleton h-4 w-14 rounded ml-auto"></div></td>
														<td class="p-4 text-right"><div class="skeleton h-4 w-16 rounded ml-auto"></div></td>
														<td class="p-4 pr-6 text-center"><div class="skeleton h-4 w-12 rounded-full mx-auto"></div></td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/disease')}
						<!-- Disease AI scanner page skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="space-y-2 mb-8">
								<div class="skeleton h-8 w-60 rounded-xl"></div>
								<div class="skeleton h-4 w-96 rounded-lg"></div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
								<div class="lg:col-span-7 bg-white border border-slate-200/50 rounded-2xl p-6 min-h-[420px] flex flex-col justify-between">
									<div class="flex justify-between items-center mb-4">
										<div class="skeleton h-5 w-24 rounded"></div>
										<div class="skeleton h-6 w-20 rounded"></div>
									</div>
									<div class="skeleton h-64 w-full rounded-xl flex-grow"></div>
								</div>
								<div class="lg:col-span-5 bg-white border border-slate-200/50 rounded-2xl p-6 space-y-6">
									<div class="flex items-center gap-4">
										<div class="skeleton h-16 w-16 rounded-full shrink-0"></div>
										<div class="space-y-2 flex-1">
											<div class="skeleton h-4 w-1/3 rounded"></div>
											<div class="skeleton h-4 w-1/2 rounded"></div>
										</div>
									</div>
									<div class="skeleton h-24 w-full rounded-xl"></div>
									<div class="skeleton h-32 w-full rounded-xl"></div>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/products')}
						<!-- Farmer products listings Specific skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-44 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
								<div class="skeleton h-10 w-36 rounded-full shrink-0"></div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{#each Array(3) as _}
									<div class="bg-white rounded-2xl p-5 border border-slate-200/50 space-y-4 shadow-sm">
										<div class="relative h-48 w-full">
											<div class="skeleton h-full w-full rounded-xl"></div>
											<div class="absolute top-3 right-3 flex gap-1.5">
												<div class="skeleton h-8 w-8 rounded-full"></div>
												<div class="skeleton h-8 w-8 rounded-full"></div>
												<div class="skeleton h-8 w-8 rounded-full"></div>
											</div>
										</div>
										<div class="flex justify-between items-center text-xs">
											<div class="skeleton h-5 w-16 rounded-full"></div>
											<div class="skeleton h-4 w-24 rounded"></div>
										</div>
										<div class="skeleton h-4.5 w-full rounded"></div>
										<div class="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
											<div class="skeleton h-3.5 w-full rounded"></div>
											<div class="skeleton h-3.5 w-full rounded"></div>
										</div>
										<div class="pt-3 border-t border-slate-100 flex items-center justify-between">
											<div class="space-y-1">
												<div class="skeleton h-2 w-20 rounded"></div>
												<div class="skeleton h-5 w-24 rounded"></div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else if targetPath.includes('/customer/dashboard')}
						<!-- Buyer Marketplace listings Specific skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-48 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
							</div>
							<div class="bg-white border border-slate-200/50 rounded-2xl p-5 mb-6 space-y-4">
								<div class="skeleton h-10 w-full rounded-xl"></div>
								<div class="flex gap-2 overflow-x-auto pb-1">
									{#each Array(5) as _}
										<div class="skeleton h-8 w-16 rounded-full shrink-0"></div>
									{/each}
								</div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
								<div class="lg:col-span-9 space-y-4">
									<div class="flex justify-between items-center mb-1">
										<div class="skeleton h-4.5 w-48 rounded"></div>
										<div class="skeleton h-4 w-24 rounded"></div>
									</div>
									<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
										{#each Array(4) as _}
											<div class="bg-white rounded-2xl border border-slate-200/50 p-4 space-y-3.5 shadow-sm">
												<div class="h-40 bg-slate-200 rounded-xl w-full skeleton"></div>
												<div class="flex justify-between items-center text-[10px]">
													<div class="skeleton h-4.5 w-14 rounded-full"></div>
													<div class="skeleton h-4 w-16 rounded"></div>
												</div>
												<div class="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50 text-[10px]">
													<div class="flex justify-between py-0.5"><div class="skeleton h-3 w-16 rounded"></div><div class="skeleton h-3 w-10 rounded"></div></div>
													<div class="flex justify-between py-0.5"><div class="skeleton h-3 w-14 rounded"></div><div class="skeleton h-3 w-12 rounded"></div></div>
												</div>
												<div class="pt-2 border-t border-slate-50 space-y-1">
													<div class="skeleton h-2 w-12 rounded"></div>
													<div class="skeleton h-4.5 w-16 rounded"></div>
												</div>
												<div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
													<div class="skeleton h-6 w-full rounded-lg"></div>
													<div class="skeleton h-6 w-full rounded-lg"></div>
												</div>
												<div class="skeleton h-6 w-full rounded-lg"></div>
											</div>
										{/each}
									</div>
								</div>
								<div class="lg:col-span-3 space-y-6">
									<div class="bg-white rounded-2xl border border-slate-200/50 p-5 space-y-4">
										<div class="skeleton h-6 w-32 rounded"></div>
										<div class="skeleton h-32 w-full rounded-xl"></div>
									</div>
								</div>
							</div>
						</div>
					{:else if targetPath.includes('/farmer/dashboard') || targetPath.endsWith('/farmer') || targetPath.endsWith('/farmer/')}
						<!-- Farmer dashboard specific bento skeleton -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
								<div class="space-y-2">
									<div class="skeleton h-8 w-32 rounded-xl"></div>
									<div class="skeleton h-4 w-72 rounded-lg"></div>
								</div>
								<div class="flex gap-2">
									<div class="skeleton h-10 w-24 rounded-2xl"></div>
									<div class="skeleton h-10 w-32 rounded-2xl"></div>
								</div>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
								{#each Array(4) as _}
									<div class="bg-white rounded-2xl border border-slate-200/50 p-6 flex flex-col justify-between h-36">
										<div class="flex justify-between items-start">
											<div class="skeleton h-10 w-10 rounded-2xl"></div>
											<div class="skeleton h-4 w-12 rounded-full"></div>
										</div>
										<div class="space-y-1.5">
											<div class="skeleton h-3 w-20 rounded"></div>
											<div class="skeleton h-6 w-28 rounded"></div>
										</div>
									</div>
								{/each}
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div class="lg:col-span-2 bg-white border border-slate-200/50 rounded-2xl p-6 h-96 flex flex-col justify-between">
									<div class="flex justify-between items-center mb-4">
										<div class="skeleton h-5 w-36 rounded"></div>
										<div class="flex gap-3"><div class="skeleton h-4 w-12 rounded"></div><div class="skeleton h-4 w-12 rounded"></div></div>
									</div>
									<div class="skeleton h-64 w-full rounded-xl flex-grow"></div>
								</div>
								<div class="lg:col-span-1 bg-white border border-slate-200/50 rounded-2xl p-6 h-96 flex flex-col justify-between">
									<div class="skeleton h-5 w-32 rounded mb-4"></div>
									<div class="skeleton h-48 w-48 rounded-full mx-auto my-auto shrink-0"></div>
									<div class="skeleton h-4 w-28 rounded mx-auto mt-4"></div>
								</div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div class="lg:col-span-2 bg-white border border-slate-200/50 rounded-2xl p-6 space-y-4">
									<div class="flex justify-between items-center mb-2">
										<div class="skeleton h-5 w-40 rounded"></div>
										<div class="skeleton h-4 w-16 rounded"></div>
									</div>
									<div class="space-y-3">
										{#each Array(3) as _}
											<div class="flex items-center justify-between py-2 border-b border-slate-50">
												<div class="flex items-center gap-3">
													<div class="skeleton h-8 w-8 rounded-full"></div>
													<div class="skeleton h-4 w-28 rounded"></div>
												</div>
												<div class="skeleton h-4 w-16 rounded"></div>
												<div class="skeleton h-4 w-32 rounded"></div>
											</div>
										{/each}
									</div>
								</div>
								<div class="lg:col-span-1 bg-white border border-slate-200/50 rounded-2xl p-6 flex flex-col justify-between h-[230px]">
									<div class="skeleton h-4 w-20 rounded"></div>
									<div class="skeleton h-16 w-full rounded-xl"></div>
									<div class="skeleton h-10 w-full rounded-xl"></div>
								</div>
							</div>
						</div>
					{:else}
						<!-- Default fallback bento skeleton (like admin) -->
						<div class="space-y-6 max-w-[1440px] mx-auto animate-pulse">
							<div class="flex justify-between items-center gap-4 mb-8">
								<div class="space-y-2 flex-1">
									<div class="skeleton h-8 w-1/4 rounded-xl"></div>
									<div class="skeleton h-4 w-1/3 rounded-lg"></div>
								</div>
								<div class="skeleton h-12 w-48 rounded-full shrink-0"></div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
								<div class="skeleton h-32 w-full rounded-2xl"></div>
								<div class="skeleton h-32 w-full rounded-2xl"></div>
								<div class="skeleton h-32 w-full rounded-2xl"></div>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
								<div class="lg:col-span-8 skeleton h-[420px] w-full rounded-2xl"></div>
								<div class="lg:col-span-4 space-y-6">
									<div class="skeleton h-48 w-full rounded-2xl"></div>
									<div class="skeleton h-48 w-full rounded-2xl"></div>
								</div>
							</div>
						</div>
					{/if}
				{:else}
					{@render children()}
				{/if}
			</main>

			<!-- Mobile Bottom Navigation (Visible only on mobile screen widths) -->
			<!-- Displays 6 icons: Dashboard, Disease, Crops (Crops/Irrigation/Harvest), Sales (Sales/Expenses), Inventory, Listings -->
			<nav class="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-emerald-100 flex justify-around items-center py-2.5 z-40 shadow-lg">
				{#if authState.profile && authState.profile.role === 'farmer'}
					<!-- Dashboard -->
					<a
						href="/farmer/dashboard"
						class={[
							'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
							page.url.pathname === '/farmer/dashboard' ? 'text-primary-green' : 'text-slate-500'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname === '/farmer/dashboard' ? '1' : '0'};">agriculture</span>
					</a>

					<!-- Disease -->
					<a
						href="/farmer/disease"
						class={[
							'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
							page.url.pathname === '/farmer/disease' ? 'text-primary-green' : 'text-slate-500'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname === '/farmer/disease' ? '1' : '0'};">shutter_speed</span>
					</a>

					<!-- Crops (Groups Crops, Irrigation, Harvest Logs with Dropup) -->
					<div class="relative flex flex-col items-center">
						{#if cropsDropupOpen}
							<div class="absolute bottom-[52px] left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-emerald-100/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] py-2 px-2.5 flex flex-col gap-1.5 min-w-[130px] z-50 animate-fade-in
								after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-t-white after:border-x-transparent after:border-b-transparent
								before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[9px] before:border-t-emerald-100/80 before:border-x-transparent before:border-b-transparent before:-z-10">
								<a
									href="/farmer/crops"
									onclick={closeDropups}
									class={['px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors', page.url.pathname === '/farmer/crops' ? 'bg-primary-green text-white' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
								>
									<span class="material-symbols-outlined text-[16px]">psychology</span>
									Crops
								</a>
								<a
									href="/farmer/irrigation"
									onclick={closeDropups}
									class={['px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors', page.url.pathname === '/farmer/irrigation' ? 'bg-primary-green text-white' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
								>
									<span class="material-symbols-outlined text-[16px]">water_drop</span>
									Irrigation
								</a>
								<a
									href="/farmer/harvests"
									onclick={closeDropups}
									class={['px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors', page.url.pathname === '/farmer/harvests' ? 'bg-primary-green text-white' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
								>
									<span class="material-symbols-outlined text-[16px]">agriculture</span>
									Harvests
								</a>
							</div>
							<!-- click outside backdrop -->
							<button aria-label="Close menu" tabindex="-1" onclick={closeDropups} class="fixed inset-0 bg-transparent z-45 cursor-default w-screen h-screen pointer-events-auto border-none outline-none"></button>
						{/if}
						<button
							type="button"
							onclick={toggleCropsDropup}
							class={[
								'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200 outline-none border-none bg-transparent cursor-pointer relative z-48',
								['/farmer/crops', '/farmer/irrigation', '/farmer/harvests'].some(p => page.url.pathname.startsWith(p)) ? 'text-primary-green' : 'text-slate-500'
							].filter(Boolean).join(' ')}
						>
							<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {['/farmer/crops', '/farmer/irrigation', '/farmer/harvests'].some(p => page.url.pathname.startsWith(p)) ? '1' : '0'};">psychology</span>
						</button>
					</div>

					<!-- Sales (Groups Sales, Expenses with Dropup) -->
					<div class="relative flex flex-col items-center">
						{#if salesDropupOpen}
							<div class="absolute bottom-[52px] left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-emerald-100/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] py-2 px-2.5 flex flex-col gap-1.5 min-w-[120px] z-50 animate-fade-in
								after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-t-white after:border-x-transparent after:border-b-transparent
								before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[9px] before:border-t-emerald-100/80 before:border-x-transparent before:border-b-transparent before:-z-10">
								<a
									href="/farmer/sales"
									onclick={closeDropups}
									class={['px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors', page.url.pathname === '/farmer/sales' ? 'bg-primary-green text-white' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
								>
									<span class="material-symbols-outlined text-[16px]">point_of_sale</span>
									Sales
								</a>
								<a
									href="/farmer/expenses"
									onclick={closeDropups}
									class={['px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors', page.url.pathname === '/farmer/expenses' ? 'bg-primary-green text-white' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
								>
									<span class="material-symbols-outlined text-[16px]">payments</span>
									Expenses
								</a>
							</div>
							<!-- click outside backdrop -->
							<button aria-label="Close menu" tabindex="-1" onclick={closeDropups} class="fixed inset-0 bg-transparent z-45 cursor-default w-screen h-screen pointer-events-auto border-none outline-none"></button>
						{/if}
						<button
							type="button"
							onclick={toggleSalesDropup}
							class={[
								'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200 outline-none border-none bg-transparent cursor-pointer relative z-48',
								['/farmer/sales', '/farmer/expenses'].some(p => page.url.pathname.startsWith(p)) ? 'text-primary-green' : 'text-slate-500'
							].filter(Boolean).join(' ')}
						>
							<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {['/farmer/sales', '/farmer/expenses'].some(p => page.url.pathname.startsWith(p)) ? '1' : '0'};">point_of_sale</span>
						</button>
					</div>

					<!-- Inventory -->
					<a
						href="/farmer/inventory"
						class={[
							'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
							page.url.pathname.startsWith('/farmer/inventory') ? 'text-primary-green' : 'text-slate-500'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname.startsWith('/farmer/inventory') ? '1' : '0'};">inventory_2</span>
					</a>

					<!-- My Listings -->
					<a
						href="/farmer/products"
						class={[
							'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
							page.url.pathname.startsWith('/farmer/products') ? 'text-primary-green' : 'text-slate-500'
						].filter(Boolean).join(' ')}
					>
						<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname.startsWith('/farmer/products') ? '1' : '0'};">storefront</span>
					</a>
				{/if}
				{#if !(authState.profile && authState.profile.role === 'farmer')}
					<!-- Fallback for standard guest/buyer accounts -->
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							class={[
								'flex flex-col items-center gap-0.5 text-xs font-bold transition-colors duration-200',
								page.url.pathname === item.href ? 'text-primary-green' : 'text-slate-500'
							].filter(Boolean).join(' ')}
						>
							<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' {page.url.pathname === item.href ? '1' : '0'};">{item.icon}</span>
						</a>
					{/each}
				{/if}

				<!-- Logout Button -->
				<button
					type="button"
					onclick={handleLogout}
					class="flex flex-col items-center gap-0.5 text-xs font-bold text-red-500"
				>
					<span class="material-symbols-outlined text-[22px]">logout</span>
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

			<main class="flex-grow flex flex-col justify-center">
				{@render children()}
			</main>
		</div>
	{/if}

	<Modal
		bind:show={modalState.show}
		type={modalState.type}
		title={modalState.title}
		confirmText={modalState.confirmText}
		cancelText={modalState.cancelText}
		onConfirm={modalState.onConfirm}
		onCancel={modalState.onCancel}
	>
		<p class="text-xs font-semibold text-slate-550 leading-relaxed">{modalState.message}</p>
	</Modal>
</div>
