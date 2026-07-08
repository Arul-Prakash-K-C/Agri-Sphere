<script>
	import { resetPassword } from '$lib/firebase-data';

	let email = $state('');
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function submitReset(event) {
		event.preventDefault();
		loading = true;
		error = '';
		success = false;

		try {
			await resetPassword(email);
			success = true;
			email = '';
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password - Agri-Sphere</title>
</svelte:head>

<section class="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-12 sm:px-6">
	<div class="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10 text-center space-y-6">
		
		<!-- Icon -->
		<div class="mx-auto grid size-12 place-items-center rounded-2xl bg-light-green text-dark-green text-2xl shadow-sm">
			🔑
		</div>

		<div class="space-y-2">
			<h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Forgot Password</h1>
			<p class="text-slate-500 text-sm">Enter your registered email below, and we will email you a password reset link.</p>
		</div>

		{#if success}
			<div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-dark-green text-left space-y-2 animate-fade-in">
				<p class="font-bold">📧 Check your inbox</p>
				<p>A password reset link has been dispatched to your email address. Follow the instructions to recover access.</p>
			</div>
		{/if}

		{#if error}
			<div class="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-left animate-fade-in">
				⚠️ {error}
			</div>
		{/if}

		<form class="space-y-4 text-left" onsubmit={submitReset}>
			<label class="block">
				<span class="text-sm font-semibold text-slate-700">Email Address</span>
				<input
					type="email"
					bind:value={email}
					required
					placeholder="name@example.com"
					class="mt-1 w-full rounded-2xl border-slate-200 focus:border-primary-green focus:ring focus:ring-primary-green/20 transition-all duration-200"
				/>
			</label>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-2xl bg-gradient-to-br from-primary-green to-dark-green py-3.5 font-semibold text-white shadow-lg shadow-primary-green/20 hover:shadow-primary-green/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{loading ? 'Sending link...' : 'Send Reset Link'}
			</button>
		</form>

		<div class="pt-4 border-t border-slate-100 flex justify-center">
			<a href="/login" class="text-sm font-bold text-primary-green hover:text-dark-green hover:underline">
				← Back to login
			</a>
		</div>

	</div>
</section>
