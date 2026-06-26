<script>
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	let products = $state([]);
	$effect(() => {
		products = data.products || [];
	});

	let showModal = $state(false);
	let editingProduct = $state(null);

	// Form values
	let formName = $state('');
	let formCategory = $state('Vegetables');
	let formPrice = $state('');
	let formQuantity = $state('');
	let formUnit = $state('KG');
	let formHarvestDate = $state('');
	let formDescription = $state('');
	let formImageUrl = $state('');
	let formLocation = $state('');
	
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

	function openAddModal() {
		editingProduct = null;
		formName = '';
		formCategory = 'Vegetables';
		formPrice = '';
		formQuantity = '';
		formUnit = 'KG';
		formHarvestDate = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
		formDescription = '';
		formImageUrl = '';
		formLocation = data.profile?.address || '';
		imageInputType = 'url';
		uploadedImagePreview = '';
		error = '';
		showModal = true;
	}

	function openEditModal(product, event) {
		if (event) event.stopPropagation();
		editingProduct = product;
		formName = product.name;
		formCategory = product.category || 'Vegetables';
		formPrice = product.price;
		formQuantity = product.quantity || '';
		formUnit = product.unit || 'KG';
		formHarvestDate = product.harvestDate || '';
		formDescription = product.description || '';
		formLocation = product.farmLocation || data.profile?.address || '';
		
		if (product.imageUrl && product.imageUrl.startsWith('data:image')) {
			imageInputType = 'file';
			uploadedImagePreview = product.imageUrl;
			formImageUrl = '';
		} else {
			imageInputType = 'url';
			formImageUrl = product.imageUrl || '';
			uploadedImagePreview = '';
		}
		error = '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingProduct = null;
		error = '';
	}

	async function handleSubmit(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const defaultImages = {
			Vegetables: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80',
			Fruits: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=600&q=80',
			Grains: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
			Dairy: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
			Legumes: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80'
		};

		const fallbackImage = defaultImages[formCategory] || defaultImages.Vegetables;
		let finalImageUrl = fallbackImage;

		if (imageInputType === 'url') {
			finalImageUrl = formImageUrl || fallbackImage;
		} else {
			finalImageUrl = uploadedImagePreview || fallbackImage;
		}

		const payload = {
			name: formName,
			category: formCategory,
			price: String(formPrice),
			quantity: Number(formQuantity),
			unit: formUnit,
			harvestDate: formHarvestDate || 'Recently Harvested',
			description: formDescription,
			imageUrl: finalImageUrl,
			farmLocation: formLocation || data.profile?.address || 'Local Fields'
		};

		try {
			let res;
			if (editingProduct) {
				res = await fetch(`/api/products/${editingProduct.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch('/api/products', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Failed to save product listing');
			}

			const savedProduct = await res.json();
			if (editingProduct) {
				products = products.map(p => p.id === editingProduct.id ? savedProduct : p);
			} else {
				products = [...products, savedProduct];
			}

			closeModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function toggleStatus(product, event) {
		if (event) event.stopPropagation();
		const nextStatus = product.status === 'Available' ? 'Sold' : 'Available';
		try {
			const res = await fetch(`/api/products/${product.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: nextStatus })
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Failed to update status');
			}

			const updated = await res.json();
			products = products.map(p => p.id === product.id ? updated : p);
		} catch (err) {
			alert(err.message);
		}
	}

	async function handleDeleteProduct(id, event) {
		if (event) event.stopPropagation();
		if (!confirm('Are you sure you want to remove this product listing?')) return;
		try {
			const res = await fetch(`/api/products/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Failed to delete product');
			}

			products = products.filter(p => p.id !== id);
		} catch (err) {
			alert(err.message);
		}
	}
</script>

<svelte:head>
	<title>Product Listings - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
				<span class="text-primary-green">🚜</span> Marketplace Listings
			</h1>
			<p class="text-sm text-slate-500 mt-1">Manage and publish your agricultural produce listings directly to customers.</p>
		</div>
		<button 
			onclick={openAddModal}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
		>
			<span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
			<span>Add Produce Listing</span>
		</button>
	</div>

	<!-- Add/Edit Product Modal -->
	{#if showModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 max-h-[95vh] flex flex-col">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100 flex-shrink-0">
					<h3 class="font-extrabold text-slate-800 text-base flex items-center gap-1">
						<span class="material-symbols-outlined text-primary-green text-lg">{editingProduct ? 'edit_note' : 'post_add'}</span>
						<span>{editingProduct ? 'Edit Produce Listing' : 'Publish New Produce'}</span>
					</h3>
					<button onclick={closeModal} class="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 flex items-center">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleSubmit} class="mt-4 space-y-4 text-xs font-semibold text-slate-700 overflow-y-auto pr-1 flex-grow">
					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Produce Name</span>
							<input type="text" bind:value={formName} required placeholder="e.g. Premium Basmati Rice" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Category</span>
							<select bind:value={formCategory} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Vegetables">Vegetables</option>
								<option value="Fruits">Fruits</option>
								<option value="Grains">Grains</option>
								<option value="Legumes">Legumes</option>
								<option value="Dairy">Dairy</option>
							</select>
						</label>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<label class="block col-span-2">
							<span class="block mb-1">Available Quantity</span>
							<input type="number" bind:value={formQuantity} min="1" step="any" required placeholder="e.g. 50" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Unit</span>
							<select bind:value={formUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="KG">KG</option>
								<option value="Tons">Tons</option>
								<option value="Pieces">Pieces</option>
								<option value="Jars">Jars</option>
							</select>
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Price per Unit (₹)</span>
							<input type="number" bind:value={formPrice} min="1" step="any" required placeholder="e.g. 180" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Harvest Date</span>
							<input type="text" bind:value={formHarvestDate} placeholder="e.g. Jun 10, 2026" class="input-field w-full text-xs" />
						</label>
					</div>

					<div class="grid grid-cols-1 gap-4">
						<label class="block">
							<span class="block mb-1">Farm Location</span>
							<input type="text" bind:value={formLocation} required placeholder="e.g. Amritsar, Punjab" class="input-field w-full text-xs" />
						</label>
					</div>

					<label class="block">
						<span class="block mb-1">Product Description</span>
						<textarea bind:value={formDescription} rows="2" placeholder="Describe the quality, freshness, bulk availability..." class="input-field w-full text-xs"></textarea>
					</label>

					<!-- Image Uploader option -->
					<div class="space-y-2">
						<span class="block mb-1">Product Image</span>
						<div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
							<button 
								type="button" 
								onclick={() => imageInputType = 'url'} 
								class={['py-1.5 rounded-lg text-[10px] font-bold transition-all', imageInputType === 'url' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
							>
								Image URL
							</button>
							<button 
								type="button" 
								onclick={() => imageInputType = 'file'} 
								class={['py-1.5 rounded-lg text-[10px] font-bold transition-all', imageInputType === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'].filter(Boolean).join(' ')}
							>
								Upload Photo
							</button>
						</div>

						{#if imageInputType === 'url'}
							<input type="url" bind:value={formImageUrl} placeholder="https://images.unsplash.com/..." class="input-field w-full text-xs" />
						{:else}
							<div class="space-y-2">
								{#if uploadedImagePreview}
									<div class="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
										<img src={uploadedImagePreview} alt="Preview" class="w-full h-full object-cover" />
										<button 
											type="button" 
											onclick={handleRemoveUploadedFile} 
											class="absolute top-2 right-2 size-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer"
										>
											<span class="material-symbols-outlined text-[16px]">delete</span>
										</button>
									</div>
								{:else}
									<label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 hover:border-primary-green/50 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group">
										<div class="flex flex-col items-center justify-center pt-5 pb-6">
											<span class="material-symbols-outlined text-slate-400 group-hover:text-primary-green text-3xl transition-colors mb-1.5">cloud_upload</span>
											<p class="text-[10px] text-slate-500 font-bold group-hover:text-slate-700 transition-colors">Drag or click to upload photo</p>
										</div>
										<input type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
									</label>
								{/if}
							</div>
						{/if}
					</div>

					{#if error}
						<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
							⚠️ {error}
						</div>
					{/if}

					<div class="flex gap-3 pt-3 border-t border-slate-100 flex-shrink-0">
						<button 
							type="button" 
							onclick={closeModal}
							class="btn-secondary flex-1 py-3 text-xs cursor-pointer"
						>
							Cancel
						</button>
						<button 
							type="submit" 
							disabled={loading}
							class="btn-primary flex-1 py-3 text-xs cursor-pointer"
						>
							{loading ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Publish Listing')}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Products Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each products as product (product.id)}
			<article class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
				<div class="relative h-48 w-full overflow-hidden">
					<img src={product.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80'} alt={product.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
					<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
					
					<div class="absolute top-3 right-3 flex gap-1.5">
						<button 
							onclick={(e) => toggleStatus(product, e)}
							class="bg-white/90 backdrop-blur-sm text-slate-700 size-8 rounded-full hover:bg-emerald-50 hover:text-dark-green transition-colors shadow-sm flex items-center justify-center cursor-pointer"
							title={product.status === 'Available' ? 'Mark as Sold' : 'Mark as Available'}
						>
							<span class="material-symbols-outlined text-[18px]">{product.status === 'Available' ? 'check_box_outline_blank' : 'check_box'}</span>
						</button>
						<button 
							onclick={(e) => openEditModal(product, e)}
							class="bg-white/90 backdrop-blur-sm text-primary-green size-8 rounded-full hover:bg-emerald-50 transition-colors shadow-sm flex items-center justify-center cursor-pointer"
							title="Edit listing"
						>
							<span class="material-symbols-outlined text-[18px]">edit</span>
						</button>
						<button 
							onclick={(e) => handleDeleteProduct(product.id, e)}
							class="bg-white/90 backdrop-blur-sm text-red-600 size-8 rounded-full hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm flex items-center justify-center cursor-pointer"
							title="Delete listing"
						>
							<span class="material-symbols-outlined text-[18px]">delete</span>
						</button>
					</div>
					
					<div class="absolute bottom-3 left-4 text-white">
						<h3 class="text-lg font-extrabold leading-none">{product.name}</h3>
						<p class="text-[10px] opacity-90 mt-1 font-semibold bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full inline-block">{product.category}</p>
					</div>
				</div>
				<div class="p-5 flex-grow flex flex-col justify-between gap-4">
					<div class="flex justify-between items-center text-xs">
						<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5',
							product.status === 'Available' ? 'bg-emerald-50 text-dark-green border-emerald-100/50' : 'bg-red-50 text-red-700 border-red-100/50'
						].filter(Boolean).join(' ')}>
							<span class={['w-1.5 h-1.5 rounded-full', product.status === 'Available' ? 'bg-primary-green' : 'bg-red-500'].filter(Boolean).join(' ')}></span>
							{product.status}
						</span>
						<span class="text-slate-400 font-bold flex items-center gap-0.5">
							<span class="material-symbols-outlined text-[15px]">pin_drop</span>
							{product.farmLocation || 'Local Fields'}
						</span>
					</div>

					<p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">{product.description || 'No description provided.'}</p>

					<div class="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-500">
						<div class="flex justify-between">
							<span>Stock Availability</span>
							<span class="text-slate-800">{product.quantity || '0'} {product.unit || 'KG'}</span>
						</div>
						<div class="flex justify-between">
							<span>Harvest Date</span>
							<span class="text-slate-800">{product.harvestDate || 'Recently'}</span>
						</div>
					</div>

					<div class="flex items-center justify-between border-t border-slate-100 pt-3">
						<div>
							<p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unit Sourcing Price</p>
							<p class="text-lg font-black text-dark-green mt-0.5">₹{product.price || '0'} <span class="text-[10px] text-slate-400 font-normal">/ {product.unit}</span></p>
						</div>
					</div>
				</div>
			</article>
		{:else}
			<div class="col-span-full py-16 text-center bg-white border border-slate-200/50 rounded-2xl shadow-sm">
				<span class="material-symbols-outlined text-4xl text-slate-300">storefront</span>
				<p class="mt-2 text-slate-500 font-medium">You haven't listed any products yet.</p>
				<button 
					onclick={openAddModal}
					class="mt-4 bg-primary-green hover:bg-dark-green text-white font-bold text-xs px-5 py-2.5 rounded-full inline-flex items-center gap-1 cursor-pointer"
				>
					<span class="material-symbols-outlined text-base">add_shopping_cart</span>
					Add Your First Produce
				</button>
			</div>
		{/each}
	</div>
</section>
