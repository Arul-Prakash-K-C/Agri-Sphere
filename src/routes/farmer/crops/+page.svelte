<script>
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	let crops = $state([]);
	$effect(() => {
		crops = data.crops || [];
	});

	// Show/hide add crop dialog
	let showAddModal = $state(false);

	// Form values
	let newName = $state('');
	let newLocation = $state('');
	let newStage = $state('Vegetative Stage');
	let newPlantedDate = $state('');
	let newProgress = $state(50);
	let newAcres = $state(10);
	let newImageUrl = $state('');

	// Image Upload Options
	let imageInputType = $state('url'); // 'url' or 'file'
	let uploadedImagePreview = $state('');
	let loading = $state(false);
	let error = $state('');

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
		uploadedImagePreview = '';
	}

	function closeModal() {
		newName = '';
		newLocation = '';
		newStage = 'Vegetative Stage';
		newPlantedDate = '';
		newProgress = 50;
		newAcres = 10;
		newImageUrl = '';
		uploadedImagePreview = '';
		imageInputType = 'url';
		showAddModal = false;
	}

	async function handleAddCrop(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const defaultImage = 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80';
		let imageUrl = defaultImage;
		if (imageInputType === 'url') {
			imageUrl = newImageUrl || defaultImage;
		} else {
			imageUrl = uploadedImagePreview || defaultImage;
		}

		try {
			const res = await fetch('/api/crops', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newName,
					location: newLocation,
					stage: newStage,
					plantedDate: newPlantedDate || 'Today',
					progress: Number(newProgress),
					acres: Number(newAcres),
					imageUrl
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to add crop');
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
		if (!confirm('Are you sure you want to delete this crop?')) return;
		try {
			const res = await fetch(`/api/crops/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete crop');
			}

			crops = crops.filter(c => c.id !== id);
		} catch (err) {
			alert(err.message);
		}
	}
</script>

<svelte:head>
	<title>Crop Management - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header & Actions -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Active Crops</h1>
			<p class="text-sm text-slate-500 mt-1">Monitor and manage your current season's yield.</p>
		</div>
		<button 
			onclick={() => showAddModal = true}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap"
		>
			<span class="material-symbols-outlined text-[18px]">add</span>
			<span>Add Crop</span>
		</button>
	</div>

	<!-- Modal Backdrop & Window -->
	{#if showAddModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base">New Crop Registration</h3>
					<button onclick={closeModal} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleAddCrop} class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
					<label class="block">
						<span class="block mb-1">Crop Name</span>
						<input type="text" bind:value={newName} required placeholder="e.g. Basmati Rice" class="input-field w-full text-xs" />
					</label>

					<label class="block">
						<span class="block mb-1">Field Location</span>
						<input type="text" bind:value={newLocation} required placeholder="e.g. Field Block C" class="input-field w-full text-xs" />
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Stage</span>
							<select bind:value={newStage} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Vegetative Stage">Vegetative</option>
								<option value="Flowering Stage">Flowering</option>
								<option value="Harvest-Ready">Harvest-Ready</option>
							</select>
						</label>
						<label class="block">
							<span class="block mb-1">Planted Date</span>
							<input type="text" bind:value={newPlantedDate} placeholder="e.g. Jun 10" class="input-field w-full text-xs" />
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Acreage (Acres)</span>
							<input type="number" bind:value={newAcres} min="1" required class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Growth Progress (%)</span>
							<input type="number" bind:value={newProgress} min="0" max="100" required class="input-field w-full text-xs" />
						</label>
					</div>

					<!-- Image Selection (URL or File Upload) -->
					<div class="space-y-2">
						<span class="block mb-1">Crop Image (Optional)</span>
						<div class="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50">
							<button
								type="button"
								onclick={() => { imageInputType = 'url'; }}
								class={[
									'flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all',
									imageInputType === 'url' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
								].filter(Boolean).join(' ')}
							>
								Image URL
							</button>
							<button
								type="button"
								onclick={() => { imageInputType = 'file'; }}
								class={[
									'flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all',
									imageInputType === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
								].filter(Boolean).join(' ')}
							>
								Upload Image
							</button>
						</div>

						{#if imageInputType === 'url'}
							<input
								type="url"
								bind:value={newImageUrl}
								placeholder="https://images.unsplash.com..."
								class="input-field w-full text-xs"
							/>
						{:else}
							{#if uploadedImagePreview}
								<div class="relative rounded-2xl overflow-hidden border border-slate-200 h-28 flex items-center justify-center bg-slate-50">
									<img src={uploadedImagePreview} alt="Uploaded crop preview" class="w-full h-full object-cover" />
									<button
										type="button"
										onclick={handleRemoveUploadedFile}
										class="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-slate-900 transition-colors shadow-sm"
									>
										<span class="material-symbols-outlined text-[14px]">close</span>
									</button>
								</div>
							{:else}
								<label class="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-primary-green hover:bg-emerald-50/20 rounded-2xl p-4 cursor-pointer transition-all duration-200 group">
									<span class="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary-green mb-1 transition-colors">cloud_upload</span>
									<span class="text-[10px] text-slate-500 font-bold group-hover:text-primary-green transition-colors">Click to upload crop photo</span>
									<span class="text-[8px] text-slate-400 mt-0.5">PNG, JPG, JPEG up to 5MB</span>
									<input
										type="file"
										accept="image/*"
										class="hidden"
										onchange={handleFileChange}
									/>
								</label>
							{/if}
						{/if}
					</div>

					{#if error}
						<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
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
			<article class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
				<div class="relative h-48 w-full overflow-hidden">
					<img src={crop.imageUrl} alt={crop.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
					<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
					
					<div class="absolute top-3 right-3 flex gap-1.5">
						<button 
							onclick={() => handleDeleteCrop(crop.id)}
							class="bg-white/80 backdrop-blur-sm text-red-600 p-1.5 rounded-full hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm"
						>
							<span class="material-symbols-outlined text-[18px]">delete</span>
						</button>
					</div>
					
					<div class="absolute bottom-3 left-4 text-white">
						<h3 class="text-lg font-extrabold leading-none">{crop.name}</h3>
						<p class="text-[10px] opacity-90 mt-1 font-semibold">{crop.location}</p>
					</div>
				</div>
				<div class="p-5 flex-grow flex flex-col justify-between gap-4">
					<div class="flex justify-between items-center text-xs">
						<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5', crop.stageColor].filter(Boolean).join(' ')}>
							<span class={['w-1.5 h-1.5 rounded-full', crop.statusDot].filter(Boolean).join(' ')}></span>
							{crop.stage}
						</span>
						<span class="text-slate-400 font-semibold flex items-center gap-1">
							<span class="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
							Planted: {crop.plantedDate}
						</span>
					</div>

					<div class="flex items-center gap-4 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
						<!-- Circular Progress Widget -->
						<div class="relative w-14 h-14 flex-shrink-0">
							<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
								<path class="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
								<path 
									class={crop.progress >= 90 ? 'text-amber-500' : 'text-primary-green'} 
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
									fill="none" 
									stroke="currentColor" 
									stroke-dasharray="{crop.progress}, 100" 
									stroke-linecap="round" 
									stroke-width="3"
								></path>
							</svg>
							<div class="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">
								{crop.progress}%
							</div>
						</div>
						<div class="flex-1">
							<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Growth Progress</p>
							<div class="flex justify-between items-end mt-1">
								<span class="text-xl font-black text-slate-800 leading-none">{crop.acres}</span>
								<span class="text-[10px] font-bold text-slate-400 uppercase">Acres</span>
							</div>
						</div>
					</div>
				</div>
			</article>
		{/each}
		{#if loading}
			<div class="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col animate-pulse">
				<div class="relative h-48 w-full bg-slate-200 skeleton">
					<div class="absolute top-3 right-3">
						<div class="bg-white/80 size-8 rounded-full skeleton"></div>
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

					<div class="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
						<div class="skeleton h-14 w-14 rounded-full shrink-0"></div>
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
