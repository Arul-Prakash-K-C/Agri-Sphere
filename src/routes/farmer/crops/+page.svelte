<script>
	import { fade, slide } from "svelte/transition";
	import Modal from "$lib/components/Modal.svelte";
	import CropCard from "$lib/components/CropCard.svelte";
	import Button from "$lib/components/Button.svelte";
	import { showConfirm, showSuccess, showError } from "$lib/modal.svelte.js";
	import { dbService } from "$lib/services/db.js";

	let { data } = $props();

	let crops = $state([]);
	$effect(() => {
		crops = data.crops || [];
	});

	// Bind page search parameter
	import { page } from '$app/state';
	let searchQuery = $derived(page.url.searchParams.get('search') || '');

	// Filter crops list based on search query parameter
	let filteredCrops = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return crops;
		return crops.filter(c => 
			(c.name || '').toLowerCase().includes(q) || 
			(c.location || '').toLowerCase().includes(q) ||
			(c.harvestDuration || '').toLowerCase().includes(q)
		);
	});

	// Show/hide add crop dialog
	let showAddModal = $state(false);

	// Form values
	let newName = $state("");
	let newLocation = $state("");
	let newHarvestDurationType = $state("Seasonal");
	let newHarvestDuration = $state("Seasonal ()");
	let newPlantedDate = $state("");
	let newAcres = $state(10);
	let newImageUrl = $state("");

	let selectedMonths = $state([]);
	let harvestDays = $state(90);

	// Image Upload Options
	let imageInputType = $state("url"); // 'url' or 'file'
	let uploadedImagePreview = $state("");
	let loading = $state(false);
	let error = $state("");

	function handleFileChange(event) {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedImagePreview = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function handleRemoveUploadedFile() {
		uploadedImagePreview = "";
	}

	function closeModal() {
		newName = "";
		newLocation = "";
		newHarvestDurationType = "Seasonal";
		newHarvestDuration = "Seasonal ()";
		selectedMonths = [];
		harvestDays = 90;
		newPlantedDate = "";
		newAcres = 10;
		newImageUrl = "";
		uploadedImagePreview = "";
		imageInputType = "url";
		showAddModal = false;
	}

	async function handleAddCrop(event) {
		event.preventDefault();
		loading = true;
		error = "";

		const defaultImage =
			"https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80";
		let imageUrl = defaultImage;
		if (imageInputType === "url") {
			imageUrl = newImageUrl || defaultImage;
		} else {
			imageUrl = uploadedImagePreview || defaultImage;
		}

		try {
			const addedCrop = await dbService.createCrop({
				name: newName,
				location: newLocation,
				plantedDate: newPlantedDate,
				harvestDuration: newHarvestDuration,
				acres: Number(newAcres),
				imageUrl,
			});

			crops = [...crops, addedCrop];
			closeModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteCrop(id) {
		const confirmed = await showConfirm({
			title: "Delete Crop?",
			message: "Are you sure you want to delete this crop? This cannot be undone.",
			confirmText: "Delete",
			confirmColor: "bg-red-650 hover:bg-red-700 text-white"
		});
		if (!confirmed) return;
		try {
			await dbService.deleteCrop(id);
			crops = crops.filter((c) => c.id !== id);
			showSuccess("Crop deleted successfully.");
		} catch (err) {
			showError(err.message);
		}
	}
</script>

<svelte:head>
	<title>Crop Management - Agri-Sphere</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header & Actions -->
	<div
		class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2"
	>
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
				Active Crops
			</h1>
			<p class="text-sm text-slate-500 mt-1">
				Monitor and manage your current season's yield.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={() => (showAddModal = true)}
				class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
			>
				<span class="material-symbols-outlined text-[18px]">add</span>
				<span>Add Crop</span>
			</button>
		</div>
	</div>

	<!-- Modal Backdrop & Window -->
	<Modal bind:show={showAddModal} size="md" title="New Crop Registration" onSubmit={handleAddCrop}>
		<div class="space-y-5 text-xs font-semibold text-slate-700">
			<!-- Section: Crop Info -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Crop Name</span>
					<input
						type="text"
						bind:value={newName}
						required
						placeholder="e.g. Basmati Rice"
						class="input-field w-full text-xs"
					/>
				</label>

				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Crop Field</span>
					<input
						type="text"
						bind:value={newLocation}
						required
						placeholder="e.g. Field Block C"
						class="input-field w-full text-xs"
					/>
				</label>
			</div>

			<!-- Section: Plant & Duration -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Planted Date</span>
					<input
						type="date"
						bind:value={newPlantedDate}
						required
						class="input-field w-full text-xs bg-white py-[7.5px]"
					/>
				</label>
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Harvest Duration</span>
					<select
						bind:value={newHarvestDurationType}
						class="input-field w-full text-xs bg-white py-[9.5px]"
						onchange={() => {
							if (newHarvestDurationType === "Seasonal") {
								newHarvestDuration =
									"Seasonal (" +
									selectedMonths.join(", ") +
									")";
							} else {
								newHarvestDuration =
									harvestDays + " Days";
							}
						}}
					>
						<option value="Seasonal">Seasonal</option>
						<option value="Days">Days</option>
					</select>
				</label>
			</div>

			{#if newHarvestDurationType === "Seasonal"}
				<div class="space-y-2">
					<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Select Active Months</span>
					<div class="grid grid-cols-4 gap-2">
						{#each ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as month}
							<button
								type="button"
								onclick={() => {
									if (
										selectedMonths.includes(month)
									) {
										selectedMonths =
											selectedMonths.filter(
												(m) => m !== month,
											);
									} else {
										selectedMonths = [
											...selectedMonths,
											month,
										];
									}
									newHarvestDuration =
										"Seasonal (" +
										selectedMonths.join(", ") +
										")";
								}}
								class={[
									"py-2 px-1 text-[10px] font-bold rounded-xl border text-center transition-all duration-200 cursor-pointer",
									selectedMonths.includes(month)
										? "bg-primary-green text-white border-primary-green shadow-sm"
										: "bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300",
								]
									.filter(Boolean)
									.join(" ")}
							>
								{month}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="space-y-1.5 animate-slide-in">
					<label class="block">
						<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Days to Harvest</span>
						<input
							type="number"
							bind:value={harvestDays}
							min="1"
							required
							class="input-field w-full text-xs"
							oninput={() => {
								newHarvestDuration =
									harvestDays + " Days";
							}}
						/>
					</label>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Acreage (Acres)</span>
					<input
						type="number"
						bind:value={newAcres}
						min="1"
						required
						class="input-field w-full text-xs"
					/>
				</label>
			</div>

			<!-- Image Selection (URL or File Upload) -->
			<div class="space-y-2.5">
				<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Crop Image (Optional)</span>
				<div
					class="flex rounded-xl bg-slate-100 dark:bg-slate-800/40 p-1 border border-slate-200/50 dark:border-slate-700"
				>
					<button
						type="button"
						onclick={() => {
							imageInputType = "url";
						}}
						class={[
							"flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer",
							imageInputType === "url"
								? "bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm"
								: "text-slate-500 hover:text-slate-800 dark:hover:text-white",
						]
							.filter(Boolean)
							.join(" ")}
					>
						Image URL
					</button>
					<button
						type="button"
						onclick={() => {
							imageInputType = "file";
						}}
						class={[
							"flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer",
							imageInputType === "file"
								? "bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm"
								: "text-slate-500 hover:text-slate-800 dark:hover:text-white",
						]
							.filter(Boolean)
							.join(" ")}
					>
						Upload Image
					</button>
				</div>

				{#if imageInputType === "url"}
					<input
						type="url"
						bind:value={newImageUrl}
						placeholder="https://images.unsplash.com..."
						class="input-field w-full text-xs"
					/>
				{:else if uploadedImagePreview}
					<div
						class="relative rounded-2xl overflow-hidden border border-slate-200 h-28 flex items-center justify-center bg-slate-50"
					>
						<img
							src={uploadedImagePreview}
							alt="Uploaded crop preview"
							class="w-full h-full object-cover"
						/>
						<button
							type="button"
							onclick={handleRemoveUploadedFile}
							class="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
						>
							<span
								class="material-symbols-outlined text-[14px]"
								>close</span
							>
						</button>
					</div>
				{:else}
					<label
						class="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-primary-green hover:bg-emerald-50/20 rounded-2xl p-4 cursor-pointer transition-all duration-200 group"
					>
						<span
							class="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary-green mb-1 transition-colors"
							>cloud_upload</span
						>
						<span
							class="text-[10px] text-slate-500 font-bold group-hover:text-primary-green transition-colors"
							>Click to upload crop photo</span
						>
						<span class="text-[8px] text-slate-400 mt-0.5"
							>PNG, JPG, JPEG up to 5MB</span
						>
						<input
							type="file"
							accept="image/*"
							class="hidden"
							onchange={handleFileChange}
						/>
					</label>
				{/if}
			</div>

			{#if error}
				<div
					class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in"
				>
					⚠️ {error}
				</div>
			{/if}
		</div>		{#snippet footer()}
			<Button
				variant="outline"
				onclick={closeModal}
				class="flex-1 py-3 text-xs"
			>
				Cancel
			</Button>
			<Button
				type="submit"
				variant="primary"
				class="flex-1 py-3 text-xs"
				disabled={loading}
			>
				{loading ? 'Registering...' : 'Register Crop'}
			</Button>
		{/snippet}
	</Modal>

	<!-- Crop Cards Bento Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each filteredCrops as crop (crop.id)}
			<CropCard 
				{crop} 
				onDelete={handleDeleteCrop}
			/>
		{/each}
		{#if loading}
			<div
				class="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col animate-pulse"
			>
				<div class="relative h-48 w-full bg-slate-200 skeleton">
					<div class="absolute top-3 right-3">
						<div
							class="bg-white/80 size-8 rounded-full skeleton"
						></div>
					</div>
					<div class="absolute bottom-3 left-4 space-y-2">
						<div class="skeleton h-5 w-32 rounded"></div>
						<div class="skeleton h-3 w-20 rounded"></div>
					</div>
				</div>
				<div class="p-5 flex-grow flex flex-col justify-between gap-4">
					<div class="flex justify-between items-center text-xs">
						<div class="skeleton h-5 w-24 rounded-full"></div>
						<div class="skeleton h-4 w-28 rounded"></div>
					</div>

					<div
						class="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100"
					>
						<div
							class="skeleton h-10 w-10 rounded-xl shrink-0"
						></div>
						<div class="space-y-2 flex-1">
							<div class="skeleton h-3 w-24 rounded"></div>
							<div class="skeleton h-5 w-16 rounded"></div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
