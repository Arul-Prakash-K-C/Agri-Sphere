<script>
	import { fade, slide } from "svelte/transition";

	let { data } = $props();

	let crops = $state([]);
	$effect(() => {
		crops = data.crops || [];
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
			const res = await fetch("/api/crops", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newName,
					location: newLocation,
					plantedDate: newPlantedDate,
					harvestDuration: newHarvestDuration,
					acres: Number(newAcres),
					imageUrl,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to add crop");
			}

			const addedCrop = await res.json();
			crops = [...crops, addedCrop];

			closeModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteCrop(id) {
		if (!confirm("Are you sure you want to delete this crop?")) return;
		try {
			const res = await fetch(`/api/crops/${id}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to delete crop");
			}

			crops = crops.filter((c) => c.id !== id);
		} catch (err) {
			alert(err.message);
		}
	}

	function getHarvestStatus(plantedDateStr, harvestDurationStr) {
		if (!harvestDurationStr) return "No duration specified";

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Case 1: Days (e.g. "90 Days" or "Days: 90")
		if (
			harvestDurationStr.toLowerCase().includes("days") ||
			/^\d+$/.test(harvestDurationStr.trim())
		) {
			const daysMatch = harvestDurationStr.match(/\d+/);
			if (daysMatch) {
				const days = parseInt(daysMatch[0], 10);
				const plantedDate = new Date(plantedDateStr);
				plantedDate.setHours(0, 0, 0, 0);

				const harvestDate = new Date(
					plantedDate.getTime() + days * 24 * 60 * 60 * 1000,
				);
				const diffTime = harvestDate.getTime() - today.getTime();
				const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

				if (diffDays > 0) {
					return `harvest in ${diffDays}days`;
				} else {
					return `Ready to harvest`;
				}
			}
		}

		// Case 2: Seasonal (e.g. "Seasonal (May, Jun, Jul, Aug, Sep, Oct)")
		if (harvestDurationStr.toLowerCase().includes("seasonal")) {
			const monthsMatch = harvestDurationStr.match(/\(([^)]+)\)/);
			if (monthsMatch) {
				const monthsList = monthsMatch[1]
					.split(",")
					.map((m) => m.trim())
					.filter(Boolean);
				const monthNames = [
					"Jan",
					"Feb",
					"Mar",
					"Apr",
					"May",
					"Jun",
					"Jul",
					"Aug",
					"Sep",
					"Oct",
					"Nov",
					"Dec",
				];

				const activeMonthIndices = monthsList
					.map((m) =>
						monthNames.findIndex((name) =>
							name.toLowerCase().startsWith(m.toLowerCase()),
						),
					)
					.filter((idx) => idx !== -1);

				if (activeMonthIndices.length === 0) return "Seasonal";

				const currentMonthIdx = today.getMonth();
				const currentYear = today.getFullYear();

				if (activeMonthIndices.includes(currentMonthIdx)) {
					return `Ready to harvest`;
				} else {
					const firstMonthName = monthsList[0];
					const firstMonthIdx = monthNames.findIndex((name) =>
						name
							.toLowerCase()
							.startsWith(firstMonthName.toLowerCase()),
					);

					let startYear = currentYear;
					if (firstMonthIdx < currentMonthIdx) {
						startYear = currentYear + 1;
					}

					const startDate = new Date(startYear, firstMonthIdx, 1);
					startDate.setHours(0, 0, 0, 0);

					const diffTime = startDate.getTime() - today.getTime();
					const diffDays = Math.ceil(
						diffTime / (1000 * 60 * 60 * 24),
					);

					return `season starts in ${diffDays}days`;
				}
			}
		}

		return harvestDurationStr;
	}
</script>

<svelte:head>
	<title>Crop Management - AgriConnect</title>
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
		<button
			onclick={() => (showAddModal = true)}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap"
		>
			<span class="material-symbols-outlined text-[18px]">add</span>
			<span>Add Crop</span>
		</button>
	</div>

	<!-- Modal Backdrop & Window -->
	{#if showAddModal}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		>
			<div
				transition:slide={{ duration: 200 }}
				class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden"
			>
				<div
					class="flex justify-between items-center pb-4 border-b border-slate-100"
				>
					<h3 class="font-extrabold text-slate-800 text-base">
						New Crop Registration
					</h3>
					<button
						onclick={closeModal}
						class="text-slate-400 hover:text-slate-600 transition-colors"
					>
						<span class="material-symbols-outlined text-lg"
							>close</span
						>
					</button>
				</div>
				<form
					onsubmit={handleAddCrop}
					class="mt-4 space-y-4 text-xs font-semibold text-slate-700"
				>
					<label class="block">
						<span class="block mb-1">Crop Name</span>
						<input
							type="text"
							bind:value={newName}
							required
							placeholder="e.g. Basmati Rice"
							class="input-field w-full text-xs"
						/>
					</label>

					<label class="block">
						<span class="block mb-1">Crop Field</span>
						<input
							type="text"
							bind:value={newLocation}
							required
							placeholder="e.g. Field Block C"
							class="input-field w-full text-xs"
						/>
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Planted Date</span>
							<input
								type="date"
								bind:value={newPlantedDate}
								required
								class="input-field w-full text-xs bg-white py-[7.5px]"
							/>
						</label>
						<label class="block">
							<span class="block mb-1">Harvest Duration</span>
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
						<div class="space-y-1.5">
							<span
								class="block mb-1 text-[11px] font-bold text-slate-500"
								>Select Active Months</span
							>
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
											"py-2 px-1 text-[10px] font-bold rounded-xl border text-center transition-all duration-200",
											selectedMonths.includes(month)
												? "bg-primary-green text-white border-primary-green shadow-sm"
												: "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
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
						<div class="space-y-1.5">
							<label class="block">
								<span class="block mb-1">Days to Harvest</span>
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

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Acreage (Acres)</span>
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
					<div class="space-y-2">
						<span class="block mb-1">Crop Image (Optional)</span>
						<div
							class="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50"
						>
							<button
								type="button"
								onclick={() => {
									imageInputType = "url";
								}}
								class={[
									"flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all",
									imageInputType === "url"
										? "bg-white text-slate-800 shadow-sm"
										: "text-slate-500 hover:text-slate-800",
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
									"flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all",
									imageInputType === "file"
										? "bg-white text-slate-800 shadow-sm"
										: "text-slate-500 hover:text-slate-800",
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
									class="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-slate-900 transition-colors shadow-sm"
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

					<div class="flex gap-3 pt-3 border-t border-slate-100">
						<button
							type="button"
							onclick={closeModal}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="btn-primary flex-1 py-3 text-xs"
						>
							Register Crop
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Crop Cards Bento Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each crops as crop (crop.id)}
			<article
				class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group"
			>
				<div class="relative h-48 w-full overflow-hidden">
					<img
						src={crop.imageUrl}
						alt={crop.name}
						class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
					/>
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
					></div>

					<div class="absolute top-3 right-3 flex gap-1.5">
						<button
							onclick={() => handleDeleteCrop(crop.id)}
							class="bg-white/80 backdrop-blur-sm text-red-600 p-1.5 rounded-full hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm"
						>
							<span class="material-symbols-outlined text-[18px]"
								>delete</span
							>
						</button>
					</div>

					<div class="absolute bottom-3 left-4 text-white">
						<h3 class="text-lg font-extrabold leading-none">
							{crop.name}
						</h3>
						<p class="text-[10px] opacity-90 mt-1 font-semibold">
							{crop.location}
						</p>
					</div>
				</div>
				<div class="p-5 flex-grow flex flex-col justify-between gap-4">
					<div class="flex justify-between items-center text-xs">
						<span
							class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100/50 bg-emerald-50 text-dark-green flex items-center gap-1.5"
							title={crop.harvestDuration}
						>
							<span
								class="w-1.5 h-1.5 rounded-full bg-primary-green"
							></span>
							{getHarvestStatus(
								crop.plantedDate,
								crop.harvestDuration,
							)}
						</span>
						<span
							class="text-slate-400 font-semibold flex items-center gap-1"
						>
							<span
								class="material-symbols-outlined text-[16px] text-slate-400"
								>calendar_month</span
							>
							Planted: {crop.plantedDate}
						</span>
					</div>

					<div
						class="flex items-center gap-4 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100"
					>
						<div
							class="size-10 rounded-xl bg-primary-green/10 flex items-center justify-center text-primary-green shrink-0"
						>
							<span class="material-symbols-outlined text-lg"
								>potted_plant</span
							>
						</div>
						<div class="flex-1">
							<p
								class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
							>
								Acreage
							</p>
							<div class="flex justify-between items-end mt-1">
								<span
									class="text-xl font-black text-slate-800 leading-none"
									>{crop.acres}</span
								>
								<span
									class="text-[10px] font-bold text-slate-400 uppercase"
									>Acres</span
								>
							</div>
						</div>
					</div>
				</div>
			</article>
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
