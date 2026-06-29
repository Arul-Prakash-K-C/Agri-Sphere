<script>
	import { page } from '$app/state';

	let action = $derived(page.url.searchParams.get('action') || 'signup');
</script>

<svelte:head>
	<title>Select Role - AgriConnect</title>
</svelte:head>

<section class="mx-auto flex min-h-[80vh] max-w-4xl items-center px-4 py-8">
	<div class="w-full text-center">
		<h1 class="mb-4 text-3xl font-extrabold text-slate-800 md:text-4xl">Choose Your Path</h1>
		<p class="mb-10 text-slate-500 font-medium">Select a role to {action === 'signup' ? 'register a new workspace' : 'login to your workspace'}.</p>

		<div class={['grid gap-6', action === 'signup' ? 'md:grid-cols-2 max-w-2xl mx-auto' : 'md:grid-cols-3'].join(' ')}>
			<!-- Farmer Card -->
			<a 
				href="/{action}?role=farmer"
				class="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center transition-all hover:border-primary-green hover:shadow-xl hover:shadow-primary-green/10"
			>
				<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-light-green text-3xl text-primary-green group-hover:scale-110 transition-transform">
					🌱
				</div>
				<h2 class="mb-2 text-xl font-bold text-slate-800">Farmer</h2>
				<p class="text-sm text-slate-500">Manage crops, inventory, sales, and run AI disease detection.</p>
			</a>

			<!-- Customer Card -->
			<a 
				href="/{action}?role=customer"
				class="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center transition-all hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10"
			>
				<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-blue-500 group-hover:scale-110 transition-transform">
					🛒
				</div>
				<h2 class="mb-2 text-xl font-bold text-slate-800">Customer</h2>
				<p class="text-sm text-slate-500">Browse marketplace, buy fresh produce, and manage orders.</p>
			</a>

			{#if action !== 'signup'}
				<!-- Admin Card -->
				<a 
					href="/{action}?role=admin"
					class="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center transition-all hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10"
				>
					<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-purple-50 text-3xl text-purple-500 group-hover:scale-110 transition-transform">
						⚙️
					</div>
					<h2 class="mb-2 text-xl font-bold text-slate-800">Admin</h2>
					<p class="text-sm text-slate-500">Oversee system operations, verify users, and view analytics.</p>
				</a>
			{/if}
		</div>
	</div>
</section>
