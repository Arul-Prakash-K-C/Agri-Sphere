<script>
	import { fade, slide } from 'svelte/transition';
	import { showConfirm, showSuccess, showError } from '$lib/modal.svelte.js';
	import { preferences } from '$lib/preferences.svelte.js';

	let { data } = $props();

	// ─── State ────────────────────────────────────────────────────────────────
	let harvests = $state([]);
	let crops    = $state([]);
	let storages = $state([]);
	let inventory = $state([]);

	$effect(() => {
		harvests = data.harvests || [];
		crops    = data.crops    || [];
		storages = data.storages || [];
		inventory = data.inventory || [];
	});

	let dateFilter = $state('All');
	let customFromDate = $state('');
	let customToDate = $state('');
	let searchQuery = $state('');
	let currentPage = $state(1);
	let showMobileDateFilterDropdown = $state(false);
	let expandedHarvestId = $state(null);
	const itemsPerPage = 10;

	function isDateInFilter(dateIso, filter) {
		if (filter === 'All') return true;
		if (!dateIso) return false;

		const saleDate = new Date(dateIso);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		switch (filter) {
			case 'Today': {
				const start = new Date(today);
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Yesterday': {
				const start = new Date(today);
				start.setDate(start.getDate() - 1);
				const end = new Date(today);
				return saleDate >= start && saleDate < end;
			}
			case 'This Week': {
				const start = new Date(today);
				start.setDate(today.getDate() - today.getDay());
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Previous Week': {
				const start = new Date(today);
				start.setDate(today.getDate() - today.getDay() - 7);
				const end = new Date(today);
				end.setDate(today.getDate() - today.getDay());
				return saleDate >= start && saleDate < end;
			}
			case 'This Month': {
				const start = new Date(today.getFullYear(), today.getMonth(), 1);
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Previous Month': {
				const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
				const end = new Date(today.getFullYear(), today.getMonth(), 1);
				return saleDate >= start && saleDate < end;
			}
			case 'This Quarter': {
				const q = Math.floor(today.getMonth() / 3);
				const start = new Date(today.getFullYear(), q * 3, 1);
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Previous Quarter': {
				const currentQuarter = Math.floor(today.getMonth() / 3);
				const start = new Date(today.getFullYear(), (currentQuarter - 1) * 3, 1);
				const end = new Date(today.getFullYear(), currentQuarter * 3, 1);
				return saleDate >= start && saleDate < end;
			}
			case 'This Half Year': {
				const start = today.getMonth() < 6
					? new Date(today.getFullYear(), 0, 1)
					: new Date(today.getFullYear(), 6, 1);
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Previous Half Year': {
				let start, end;
				if (today.getMonth() < 6) {
					start = new Date(today.getFullYear() - 1, 6, 1);
					end = new Date(today.getFullYear(), 0, 1);
				} else {
					start = new Date(today.getFullYear(), 0, 1);
					end = new Date(today.getFullYear(), 6, 1);
				}
				return saleDate >= start && saleDate < end;
			}
			case 'This Year': {
				const start = new Date(today.getFullYear(), 0, 1);
				return saleDate >= start && saleDate < tomorrow;
			}
			case 'Previous Year': {
				const start = new Date(today.getFullYear() - 1, 0, 1);
				const end = new Date(today.getFullYear(), 0, 1);
				return saleDate >= start && saleDate < end;
			}
			case 'Custom Date Range': {
				if (!customFromDate || !customToDate) return true;
				const start = new Date(customFromDate + 'T00:00:00');
				const end = new Date(customToDate + 'T23:59:59');
				return saleDate >= start && saleDate <= end;
			}
			default:
				return true;
		}
	}

	let filteredHarvests = $derived.by(() => {
		return harvests.filter(h => {
			const dateMatch = isDateInFilter(h.harvestDate, dateFilter);

			const q = searchQuery.trim().toLowerCase();
			const queryMatch = !q || (
				h.cropName?.toLowerCase().includes(q) ||
				h.category?.toLowerCase().includes(q) ||
				h.qualityGrade?.toLowerCase().includes(q) ||
				h.notes?.toLowerCase().includes(q) ||
				h.status?.toLowerCase().includes(q)
			);

			return dateMatch && queryMatch;
		});
	});

	let sortedHarvests = $derived.by(() => {
		const list = [...filteredHarvests];
		list.sort((a, b) => {
			const aSold = a.status?.toLowerCase() === 'sold' ? 1 : 0;
			const bSold = b.status?.toLowerCase() === 'sold' ? 1 : 0;
			
			if (aSold !== bSold) {
				return aSold - bSold;
			}
			
			const dateA = a.harvestDate || '';
			const dateB = b.harvestDate || '';
			if (dateA !== dateB) {
				return dateB.localeCompare(dateA);
			}
			
			const timeA = a.createdAt || '';
			const timeB = b.createdAt || '';
			return timeB.localeCompare(timeA);
		});
		return list;
	});

	let totalPages = $derived(Math.max(1, Math.ceil(sortedHarvests.length / itemsPerPage)));
	let paginatedHarvests = $derived(sortedHarvests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

	$effect(() => {
		searchQuery;
		dateFilter;
		customFromDate;
		customToDate;
		currentPage = 1;
	});

	$effect(() => {
		if (currentPage > totalPages) {
			currentPage = totalPages;
		}
	});

	// Modal visibility
	let showFormModal    = $state(false);
	let showDropdown     = $state(false);

	// Form mode: 'add' | 'edit'
	let formMode = $state('add');

	// The harvest being edited
	let editingHarvest = $state(null);
	// ─── Form fields ──────────────────────────────────────────────────────────
	let cropNameInput    = $state('');
	let selectedCropId   = $state('');
	let lifespan         = $state('');   // MANDATORY: Expiry/shelf life of the harvested product, not crop harvest duration
	let quantity         = $state('');
	let unit             = $state('Liters');
	let harvestDate      = $state(new Date().toISOString().split('T')[0]);
	let qualityGrade     = $state('Grade A');
	let notes            = $state('');
	let category         = $state('Vegetables');
	let storageId        = $state('');

	function convertToUnit(amount, fromUnit, toUnit) {
		if (!amount || isNaN(amount)) return 0;
		const from = (fromUnit || '').trim().toLowerCase();
		const to = (toUnit || '').trim().toLowerCase();
		if (from === to) return amount;
		
		if (from === 'kg' && to === 'tons') return amount / 1000;
		if (from === 'tons' && to === 'kg') return amount * 1000;
		if (from === 'g' && to === 'kg') return amount / 1000;
		if (from === 'kg' && to === 'g') return amount * 1000;
		if (from === 'ml' && to === 'liters') return amount / 1000;
		if (from === 'liters' && to === 'ml') return amount * 1000;

		return amount;
	}

	function getStorageAvailableSpace(storage, excludeHarvestId = null) {
		const occupied = inventory
			.filter(item => item.storageId === storage.id && (excludeHarvestId === null || item.sourceId !== excludeHarvestId))
			.reduce((sum, item) => sum + convertToUnit(((item.total || 0) - (item.soldUsed || 0)), item.unit, storage.unit), 0);
		
		return Math.max(0, storage.capacity - occupied);
	}

	let availableStorages = $derived(
		storages.filter(s =>
			s.categories &&
			s.categories.map(c => c.toLowerCase()).includes(category.toLowerCase())
		).map(s => {
			const avail = getStorageAvailableSpace(s, editingHarvest?.id);
			return {
				...s,
				availableSpace: Math.round(avail * 1000) / 1000
			};
		})
	);
	// Loading / error
	let loading     = $state(false);
	let error       = $state('');
	let deleteLoading = $state(false);

	// ─── Quality grade badge colours ──────────────────────────────────────────
	const gradeColors = {
		'Grade A+': 'bg-emerald-50 text-dark-green border-emerald-200',
		'Grade A':  'bg-green-50   text-green-700  border-green-200',
		'Grade B':  'bg-amber-50   text-amber-700  border-amber-200',
		'Grade C':  'bg-orange-50  text-orange-700 border-orange-200',
		'Mixed':    'bg-violet-50  text-violet-700 border-violet-200'
	};

	function gradeClass(grade) {
		return gradeColors[grade] || 'bg-slate-50 text-slate-600 border-slate-200';
	}

	// ─── Open modals ─────────────────────────────────────────────────────────
	function openAddModal() {
		formMode       = 'add';
		editingHarvest = null;
		resetForm();
		showFormModal  = true;
		error          = '';
	}

	function openEditModal(harvest) {
		formMode         = 'edit';
		editingHarvest   = harvest;
		selectedCropId   = harvest.cropId || '';
		cropNameInput    = harvest.cropName || '';
		lifespan         = harvest.lifespan ? (harvest.lifespan.match(/(\d+)/)?.[1] || '') : '';
		quantity         = String(harvest.quantity);
		unit             = harvest.unit || 'Liters';
		harvestDate      = harvest.harvestDate || new Date().toISOString().split('T')[0];
		qualityGrade     = harvest.qualityGrade || 'Grade A';
		notes            = harvest.notes || '';
		category         = harvest.category || 'Vegetables';
		storageId        = harvest.storageId || '';
		showFormModal    = true;
		error            = '';
	}

	async function confirmDelete(harvest) {
		const confirmed = await showConfirm({
			title: 'Delete Harvest Log?',
			message: `Are you sure you want to delete the harvest log of ${harvest.quantity} ${harvest.unit} of "${harvest.cropName}"? This action cannot be undone.`,
			confirmText: 'Delete',
			confirmColor: 'bg-red-600 hover:bg-red-700 text-white'
		});
		if (!confirmed) return;

		try {
			const res = await fetch('/api/harvests/' + harvest.id, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to delete harvest');
			}

			harvests = harvests.filter(h => h.id !== harvest.id);
			showSuccess('Harvest log deleted successfully.');
		} catch (err) {
			showError(err.message);
		}
	}

	function closeFormModal() {
		showFormModal  = false;
		editingHarvest = null;
		resetForm();
	}

	function resetForm() {
		cropNameInput   = '';
		selectedCropId  = '';
		lifespan        = '';
		quantity        = '';
		unit            = 'Liters';
		harvestDate     = new Date().toISOString().split('T')[0];
		qualityGrade    = 'Grade A';
		notes           = '';
		category        = 'Vegetables';
		storageId       = '';
		error           = '';
		showDropdown    = false;
	}

	// ─── Crop input change handler (DO NOT auto-fill lifespan) ─────────────────
	function onCropNameChange() {
		const match = crops.find(c => c.name.toLowerCase() === cropNameInput.trim().toLowerCase());
		if (match) {
			selectedCropId = match.id;
		} else {
			selectedCropId = '';
		}
	}

	// ─── Dropdown option click handler ─────────────────────────────────────────
	function selectCrop(crop) {
		cropNameInput = crop.name;
		selectedCropId = crop.id;
		showDropdown = false;
	}

	// ─── Submit: Add harvest ──────────────────────────────────────────────────
	async function handleAddHarvest(event) {
		event.preventDefault();
		loading = true;
		error   = '';

		try {
			let cropId  = selectedCropId;
			let cropName = cropNameInput.trim();
			let finalLifespan = lifespan ? (lifespan + " Days") : '';

			if (!cropName) { error = 'Please enter a crop.'; loading = false; return; }
			if (!storageId) { error = 'Please select a storage location.'; loading = false; return; }

			const storage = storages.find(s => s.id === storageId);
			if (storage) {
				const avail = getStorageAvailableSpace(storage);
				const quantityInStorageUnit = convertToUnit(Number(quantity), unit, storage.unit);
				if (quantityInStorageUnit > avail) {
					error = `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}. Required: ${Math.round(quantityInStorageUnit * 100) / 100} ${storage.unit}.`;
					loading = false;
					return;
				}
			}

			// Resolve cropId if it matches an existing crop by name (without adding new crops)
			if (!cropId) {
				const match = crops.find(c => c.name.toLowerCase() === cropName.toLowerCase());
				if (match) {
					cropId = match.id;
					cropName = match.name;
				}
			}

			const res = await fetch('/api/harvests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cropName,
					cropId,
					lifespan: finalLifespan,
					quantity: Number(quantity),
					unit,
					harvestDate,
					qualityGrade,
					notes,
					category,
					storageId
				})
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to log harvest');
			}

			const added = await res.json();
			harvests    = [added, ...harvests];
			// Fetch updated inventory to recalculate storage capacity correctly
			const invRes = await fetch('/api/inventory');
			if (invRes.ok) {
				const invData = await invRes.json();
				inventory = invData.inventory || [];
			}
			closeFormModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// ─── Submit: Edit harvest ─────────────────────────────────────────────────
	async function handleUpdateHarvest(event) {
		event.preventDefault();
		loading = true;
		error   = '';

		try {
			let cropId   = selectedCropId;
			let cropName = cropNameInput.trim();
			let finalLifespan = lifespan ? (lifespan + " Days") : '';

			if (!cropName) { error = 'Please enter a crop.'; loading = false; return; }
			if (!storageId) { error = 'Please select a storage location.'; loading = false; return; }

			const storage = storages.find(s => s.id === storageId);
			if (storage) {
				const avail = getStorageAvailableSpace(storage, editingHarvest.id);
				const quantityInStorageUnit = convertToUnit(Number(quantity), unit, storage.unit);
				if (quantityInStorageUnit > avail) {
					error = `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}. Required: ${Math.round(quantityInStorageUnit * 100) / 100} ${storage.unit}.`;
					loading = false;
					return;
				}
			}

			// Resolve cropId if it matches an existing crop by name (without adding new crops)
			if (!cropId) {
				const match = crops.find(c => c.name.toLowerCase() === cropName.toLowerCase());
				if (match) {
					cropId = match.id;
					cropName = match.name;
				}
			}

			const res = await fetch('/api/harvests/' + editingHarvest.id, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cropName,
					cropId,
					lifespan: finalLifespan,
					quantity: Number(quantity),
					unit,
					harvestDate,
					qualityGrade,
					notes,
					category,
					storageId
				})
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to update harvest');
			}

			const updated = await res.json();
			harvests = harvests.map(h => h.id === updated.id ? updated : h);
			// Fetch updated inventory to recalculate storage capacity correctly
			const invRes = await fetch('/api/inventory');
			if (invRes.ok) {
				const invData = await invRes.json();
				inventory = invData.inventory || [];
			}
			closeFormModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}



	// ─── Helpers ──────────────────────────────────────────────────────────────
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	/**
	 * Compute how many days remain until the next harvest cycle.
	 * Uses harvestDate + lifespan days as the projected next harvest date.
	 * Returns { label, icon, classes, daysRemaining } or null if unparseable.
	 */
	function getLifespanStatus(harvestDateStr, lifespanStr) {
		if (!lifespanStr || !harvestDateStr) return null;

		// Parse the number of days out of the lifespan string (e.g. "42 Days", "90 Days")
		const match = lifespanStr.match(/(\d+)/);
		if (!match) return null;

		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(harvestDateStr + 'T00:00:00');
		const nextHarvest = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const diffMs = nextHarvest.getTime() - today.getTime();
		const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

		if (daysRemaining > 7) {
			return {
				label: 'Good',
				icon: 'check_circle',
				classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
				daysRemaining
			};
		} else if (daysRemaining > 2) {
			return {
				label: 'Soon',
				icon: 'schedule',
				classes: 'bg-amber-50 text-amber-700 border-amber-200',
				daysRemaining
			};
		} else if (daysRemaining > 0) {
			return {
				label: daysRemaining + 'd left',
				icon: 'warning',
				classes: 'bg-red-50 text-red-600 border-red-200',
				daysRemaining
			};
		} else {
			return {
				label: 'Overdue',
				icon: 'error',
				classes: 'bg-red-100 text-red-700 border-red-300',
				daysRemaining
			};
		}
	}
</script>

<svelte:head>
	<title>Harvest Logs — Agri-Sphere</title>
	<meta name="description" content="Record, manage, and track your farm harvest yields and product quality." />
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">

	<!-- ── Page Header ────────────────────────────────────────────────────── -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Harvest Logs</h1>
			<p class="text-sm text-slate-500 mt-1">Record and track your farm yields and product quality.</p>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={openAddModal}
				class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/40 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
			>
				<span class="material-symbols-outlined text-[18px]">add_circle</span>
				<span>Log New Harvest</span>
			</button>
		</div>
	</div>

	<!-- ── Add / Edit Modal ────────────────────────────────────────────────── -->
	{#if showFormModal}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={formMode === 'add' ? 'Log New Harvest' : 'Edit Harvest Log'}
		>
			<div
				transition:slide={{ duration: 200 }}
				class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden"
			>
				<!-- Modal Header -->
				<div class="flex justify-between items-center px-6 py-4 border-b border-slate-100">
					<div>
						<h3 class="font-extrabold text-slate-800 text-base">
							{formMode === 'add' ? 'New Harvest Log' : 'Edit Harvest Log'}
						</h3>
						<p class="text-[11px] text-slate-400 mt-0.5">
							{formMode === 'add' ? 'Fill in the details to record a new harvest.' : 'Update the harvest log details below.'}
						</p>
					</div>
					<button
						onclick={closeFormModal}
						class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
						aria-label="Close modal"
					>
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>

				<!-- Modal Body / Form -->
				<form
					onsubmit={formMode === 'add' ? handleAddHarvest : handleUpdateHarvest}
					class="px-6 py-5 space-y-4 text-xs font-semibold text-slate-700 max-h-[80vh] overflow-y-auto"
				>
					<!-- ── Crop Selection ────────────────────────────────── -->
					<div class="relative">
						<label for="harvest-crop" class="block mb-1.5 font-bold text-slate-700">
							Crop <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								id="harvest-crop"
								type="text"
								bind:value={cropNameInput}
								oninput={onCropNameChange}
								onfocus={() => showDropdown = true}
								onblur={() => setTimeout(() => showDropdown = false, 200)}
								placeholder="Select or type a crop..."
								required
								class="input-field w-full text-xs bg-white pr-8 font-semibold"
								autocomplete="off"
							/>
							<button
								type="button"
								onclick={() => showDropdown = !showDropdown}
								class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
							>
								<span class="material-symbols-outlined text-[20px] leading-none">arrow_drop_down</span>
							</button>

							{#if showDropdown}
								<div class="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
									{#each crops as crop (crop.id)}
										<button
											type="button"
											onmousedown={(e) => { e.preventDefault(); selectCrop(crop); }}
											class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-dark-green transition-colors font-bold"
										>
											{crop.name}
										</button>
									{:else}
										<div class="px-4 py-2 text-xs text-slate-400 font-medium">No crops registered yet</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- ── Lifespan (MANDATORY — Product shelf life / expiry) ──── -->
					<div>
						<label for="harvest-lifespan" class="block mb-1.5 font-bold text-slate-700">
							Lifespan (Days) <span class="text-red-500">*</span>
						</label>
						<input
							id="harvest-lifespan"
							type="number"
							min="1"
							step="1"
							bind:value={lifespan}
							required
							placeholder="e.g. 12"
							class="input-field w-full text-xs"
						/>
					</div>

					<!-- ── Quantity + Unit ───────────────────────────────── -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="harvest-qty" class="block mb-1.5 font-bold text-slate-700">
								Quantity <span class="text-red-500">*</span>
							</label>
							<input
								id="harvest-qty"
								type="number"
								bind:value={quantity}
								min="0.01"
								step="any"
								required
								placeholder="e.g. 120"
								class="input-field w-full text-xs"
							/>
						</div>
						<div>
							<label for="harvest-unit" class="block mb-1.5 font-bold text-slate-700">Unit</label>
							<select
								id="harvest-unit"
								bind:value={unit}
								class="input-field w-full text-xs bg-white py-[9.5px]"
							>
								<option value="Liters">Liters</option>
								<option value="Tons">Tons</option>
								<option value="kg">kg</option>
								<option value="Bags">Bags</option>
								<option value="Units">Units</option>
							</select>
						</div>
					</div>

					<!-- ── Harvest Date + Quality Grade ─────────────────── -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="harvest-date" class="block mb-1.5 font-bold text-slate-700">
								Harvest Date <span class="text-red-500">*</span>
							</label>
							<input
								id="harvest-date"
								type="date"
								bind:value={harvestDate}
								required
								class="input-field w-full text-xs bg-white"
							/>
						</div>
						<div>
							<label for="harvest-grade" class="block mb-1.5 font-bold text-slate-700">Quality Grade</label>
							<select
								id="harvest-grade"
								bind:value={qualityGrade}
								class="input-field w-full text-xs bg-white py-[9.5px]"
							>
								<option value="Grade A+">Grade A+</option>
								<option value="Grade A">Grade A</option>
								<option value="Grade B">Grade B</option>
								<option value="Grade C">Grade C</option>
								<option value="Mixed">Mixed</option>
							</select>
						</div>
					</div>

					<!-- ── Category ────────────────────────────────────── -->
					<div>
						<label for="harvest-category" class="block mb-1.5 font-bold text-slate-700">Category <span class="text-red-500">*</span></label>
						<select
							id="harvest-category"
							bind:value={category}
							required
							class="input-field w-full text-xs bg-white py-[9.5px]"
						>
							<option value="Vegetables">Vegetables</option>
							<option value="Fruits">Fruits</option>
							<option value="Seeds">Seeds</option>
							<option value="Fertilizers">Fertilizers</option>
							<option value="Chemicals">Chemicals</option>
							<option value="Grains">Grains</option>
							<option value="Others">Others</option>
						</select>
					</div>

					<!-- ── Storage Location ────────────────────────────── -->
					<div>
						<label for="harvest-storage" class="block mb-1.5 font-bold text-slate-700">
							Storage Location <span class="text-red-500">*</span>
						</label>
						<select
							id="harvest-storage"
							bind:value={storageId}
							required
							class="input-field w-full text-xs bg-white py-[9.5px] disabled:opacity-60 disabled:cursor-not-allowed"
							disabled={!category}
						>
							<option value="" disabled>— Select storage location —</option>
							{#each availableStorages as storage (storage.id)}
								<option value={storage.id}>{storage.name} (Available: {storage.availableSpace} {storage.unit} / Capacity: {storage.capacity} {storage.unit})</option>
							{:else}
								<option value="" disabled>No storages configured for {category}</option>
							{/each}
						</select>
						{#if availableStorages.length === 0 && category}
							<p class="text-[10px] text-amber-600 mt-1 font-bold">
								⚠️ Configure a storage for "{category}" in the Inventory module first.
							</p>
						{/if}
					</div>

					<!-- ── Notes ─────────────────────────────────────────── -->
					<div>
						<label for="harvest-notes" class="block mb-1.5 font-bold text-slate-700">Notes</label>
						<textarea
							id="harvest-notes"
							bind:value={notes}
							rows="3"
							placeholder="Any additional details about this harvest…"
							class="input-field w-full text-xs resize-none"
						></textarea>
					</div>

					<!-- ── Error Banner ───────────────────────────────────── -->
					{#if error}
						<div
							transition:slide={{ duration: 150 }}
							class="rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700 flex items-start gap-2 animate-fade-in"
						>
							<span class="material-symbols-outlined text-[15px] shrink-0 mt-0.5">warning</span>
							<span>{error}</span>
						</div>
					{/if}

					<!-- ── Form Actions ───────────────────────────────────── -->
					<div class="flex gap-3 pt-2 border-t border-slate-100">
						<button
							type="button"
							onclick={closeFormModal}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							class="btn-primary flex-1 py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{#if loading}
								<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
								{formMode === 'add' ? 'Saving…' : 'Updating…'}
							{:else}
								<span class="material-symbols-outlined text-[15px]">{formMode === 'add' ? 'add_circle' : 'check_circle'}</span>
								{formMode === 'add' ? 'Submit Log' : 'Save Changes'}
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}



	<!-- Mobile view (hidden on desktop md:block) -->
	<div class="block md:hidden p-4 rounded-3xl relative border shadow-2xl space-y-6 font-sans transition-colors duration-300 {preferences.theme === 'dark' ? 'bg-[#121212] border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-800'}">
		<!-- 1) Header Section -->
		<div class="flex items-center justify-between py-2 border-b gap-4 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
			<div>
				<h2 class="text-sm font-black tracking-widest uppercase select-none {preferences.theme === 'dark' ? 'text-white' : 'text-slate-850'}">
					HARVEST REGISTER
				</h2>
				<p class="text-[10px] font-semibold mt-0.5 {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-450'}">
					All logged harvests for your farm
				</p>
			</div>
			
			<div class="flex items-center gap-2 relative">
				<!-- Calendar Button -->
				<button 
					type="button" 
					onclick={() => showMobileDateFilterDropdown = !showMobileDateFilterDropdown}
					class="flex items-center justify-center rounded-xl size-9 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-white hover:bg-slate-800' : 'bg-white text-slate-700 hover:bg-slate-50'}"
					title="Filter by Date"
				>
					<span class="material-symbols-outlined text-[18px]">calendar_month</span>
				</button>
				
				<!-- Add Button -->
				<button 
					type="button" 
					onclick={openAddModal}
					class="flex items-center justify-center rounded-xl size-9 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-white hover:bg-slate-800' : 'bg-white text-slate-700 hover:bg-slate-50'}"
					title="Log New Harvest"
				>
					<span class="material-symbols-outlined text-[18px]">add</span>
				</button>

				{#if showMobileDateFilterDropdown}
					<!-- Date filter options floating menu -->
					<div class="absolute right-0 top-11 z-50 border rounded-xl shadow-2xl py-1.5 min-w-[150px] text-xs font-bold transition-colors duration-300 {preferences.theme === 'dark' ? 'bg-[#1e1e1e] border-slate-800 text-slate-350' : 'bg-white border-slate-200 text-slate-650'}">
						{#each ['All', 'Today', 'Yesterday', 'This Week', 'Previous Week', 'This Month', 'Previous Month', 'This Quarter', 'This Year'] as option}
							<button
								type="button"
								onclick={() => { dateFilter = option; showMobileDateFilterDropdown = false; }}
								class="w-full text-left px-4 py-2 transition-colors {preferences.theme === 'dark' ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'} {dateFilter === option ? 'text-primary-green' : ''}"
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- 2) Search row -->
		<div class="flex items-center justify-between gap-3">
			<div class="relative flex-1">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[15px]">search</span>
				<input
					type="text"
					placeholder="Search crop, grade, status..."
					bind:value={searchQuery}
					class="w-full rounded-full pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-green/30 transition-all shadow-sm focus:shadow-md {preferences.theme === 'dark' ? 'bg-[#1a1a1a] text-slate-300 placeholder-slate-600' : 'bg-white text-slate-700 placeholder-slate-400'}"
				/>
			</div>
			<div class="border px-3.5 py-1.5 rounded-full text-[10px] font-bold shrink-0 shadow-inner {preferences.theme === 'dark' ? 'bg-[#1a1a1a] text-slate-400 border-slate-850' : 'bg-slate-50 text-slate-650 border-slate-200'}">
				{sortedHarvests.length} {sortedHarvests.length === 1 ? 'log' : 'logs'}
			</div>
		</div>

		<!-- 3) Harvest Card List -->
		<div class="space-y-3">
			{#each paginatedHarvests as harvest (harvest.id)}
				{@const crop = crops.find(c => c.id === harvest.cropId || c.name.toLowerCase() === harvest.cropName?.toLowerCase())}
				{@const imageUrl = crop?.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80'}
				{@const status = getLifespanStatus(harvest.harvestDate, harvest.lifespan)}
				
				<!-- Card wrapper -->
				<div 
					role="button"
					tabindex="0"
					onclick={() => expandedHarvestId = (expandedHarvestId === harvest.id ? null : harvest.id)}
					onkeydown={(e) => e.key === 'Enter' && (expandedHarvestId = (expandedHarvestId === harvest.id ? null : harvest.id))}
					class="border rounded-2xl p-3 flex flex-col gap-1 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 {preferences.theme === 'dark' ? 'bg-[#161616] border-slate-900/60 hover:border-slate-800' : 'bg-white border-slate-200/50 hover:border-slate-350'}"
				>
					<!-- Top Row: Thumbnail + Info (Name, Badges, Details) + Arrow -->
					<div class="flex items-center justify-between w-full gap-2.5">
						<!-- Left & middle content row -->
						<div class="flex items-center gap-3 flex-grow min-w-0">
							<!-- Crop Image -->
							<img 
								src={imageUrl} 
								alt={harvest.cropName} 
								class="size-12 rounded-xl object-cover border shrink-0 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/50'}"
							/>
							
							<!-- Info block -->
							<div class="min-w-0 flex-grow">
								<!-- First Line: Name + Grade + Status -->
								<div class="flex items-center gap-1.5 flex-wrap">
									<h3 class="text-xs font-bold truncate max-w-[110px] leading-none {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">
										{harvest.cropName}
									</h3>
									
									<!-- Grade badge -->
									<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#14231b] text-[#52c486] border border-[#1a3828]' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'}">
										{harvest.qualityGrade || 'Grade A'}
									</span>

									<!-- Status badge (Without check/warning icons) -->
									{#if harvest.status?.toLowerCase() === 'sold'}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-slate-350 border-[#2d2d2d]' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
											Sold
										</span>
									{:else if status}
										{@const isRed = status.classes.includes('text-red-700') || status.classes.includes('text-red-600') || status.label.includes('left') || status.label.includes('Overdue')}
										{@const isYellow = status.classes.includes('text-amber-700')}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {isRed ? (preferences.theme === 'dark' ? 'bg-[#281515] text-[#f87171] border-[#4c1d1d]' : 'bg-red-50 text-red-600 border-red-100/50') : (isYellow ? (preferences.theme === 'dark' ? 'bg-[#2a2115] text-[#f59e0b] border-[#45321f]' : 'bg-amber-50 text-amber-600 border-amber-100/50') : (preferences.theme === 'dark' ? 'bg-[#14231b] text-[#52c486] border border-[#1a3828]' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'))}">
											{status.label}
										</span>
									{/if}
								</div>
								
								<!-- Second Line: Details -->
								<p class="text-[9.5px] font-semibold mt-1 whitespace-nowrap {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-450'}">
									{harvest.quantity} {harvest.unit} • {formatDate(harvest.harvestDate)}
								</p>
							</div>
						</div>

						<!-- Right Chevron (Dynamic Arrow) -->
						<span class="material-symbols-outlined text-base leading-none pl-1 shrink-0 {preferences.theme === 'dark' ? 'text-slate-550' : 'text-slate-400'}">
							{expandedHarvestId === harvest.id ? 'keyboard_arrow_down' : 'chevron_right'}
						</span>
					</div>

					<!-- Expanded Panel (Accordion Content) -->
					{#if expandedHarvestId === harvest.id}
						<div transition:slide={{ duration: 150 }} class="mt-3 pt-3 border-t space-y-3 text-[11px] font-semibold transition-colors duration-300 {preferences.theme === 'dark' ? 'border-slate-900/60 text-slate-350' : 'border-slate-205 text-slate-600'}">
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Lifespan</span>
								<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{harvest.lifespan || '—'}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Notes</span>
								<span class="font-extrabold truncate max-w-[200px] {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{harvest.notes || '—'}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Status</span>
								<!-- Status badge in details -->
								{#if harvest.status?.toLowerCase() === 'sold'}
									<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-slate-350 border-[#2d2d2d]' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
										Sold
									</span>
								{:else if status}
									{@const isRed = status.classes.includes('text-red-700') || status.classes.includes('text-red-600') || status.label.includes('left') || status.label.includes('Overdue')}
									{@const isYellow = status.classes.includes('text-amber-700')}
									<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {isRed ? (preferences.theme === 'dark' ? 'bg-[#281515] text-[#f87171] border-[#4c1d1d]' : 'bg-red-50 text-red-600 border-red-100/50') : (isYellow ? (preferences.theme === 'dark' ? 'bg-[#2a2115] text-[#f59e0b] border-[#45321f]' : 'bg-amber-50 text-amber-600 border-amber-100/50') : (preferences.theme === 'dark' ? 'bg-[#14231b] text-[#52c486] border border-[#1a3828]' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'))}">
										{status.label}
									</span>
								{/if}
							</div>
							
							<div class="flex justify-end gap-4 pt-2 text-[11px] font-bold">
								<button 
									type="button" 
									onclick={(e) => { e.stopPropagation(); openEditModal(harvest); }} 
									class="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
								>
									<span class="material-symbols-outlined text-[13px]">edit</span>
									<span>Edit</span>
								</button>
								<button 
									type="button" 
									onclick={(e) => { e.stopPropagation(); confirmDelete(harvest); }} 
									class="flex items-center gap-1 text-red-500 hover:text-red-400 transition-colors cursor-pointer"
								>
									<span class="material-symbols-outlined text-[13px]">delete</span>
									<span>Delete</span>
								</button>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="py-12 text-center border rounded-2xl {preferences.theme === 'dark' ? 'bg-[#161616] border-slate-900' : 'bg-slate-50 border-slate-200'}">
					<span class="material-symbols-outlined text-3xl text-slate-600">inventory_2</span>
					<p class="mt-2 text-xs font-semibold {preferences.theme === 'dark' ? 'text-slate-450' : 'text-slate-500'}">No harvests logged yet</p>
				</div>
			{/each}
		</div>

		<!-- 4) Footer / Pagination -->
		<div class="flex items-center justify-between pt-4 border-t text-[10px] font-semibold {preferences.theme === 'dark' ? 'border-slate-900/60 text-slate-500' : 'border-slate-200/60 text-slate-450'}">
			<span>
				{#if sortedHarvests.length > 0}
					Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, sortedHarvests.length)} of {sortedHarvests.length} records
				{:else}
					Showing 0 of 0 records
				{/if}
			</span>

			{#if totalPages > 1}
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						disabled={currentPage === 1}
						onclick={() => currentPage = Math.max(1, currentPage - 1)}
						class="px-2 py-1 rounded-md border text-[9px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors {preferences.theme === 'dark' ? 'border-slate-800 bg-[#1e1e1e] text-slate-400 hover:bg-slate-800' : 'border-slate-250 bg-slate-50 text-slate-650 hover:bg-slate-100'}"
					>
						Prev
					</button>

					<span class="font-bold px-1 {preferences.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}">{currentPage} / {totalPages}</span>

					<button
						type="button"
						disabled={currentPage === totalPages}
						onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
						class="px-2 py-1 rounded-md border text-[9px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors {preferences.theme === 'dark' ? 'border-slate-800 bg-[#1e1e1e] text-slate-400 hover:bg-slate-800' : 'border-slate-250 bg-slate-50 text-slate-650 hover:bg-slate-100'}"
					>
						Next
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- ── Harvest Table ────────────────────────────────────────────────────── -->
	<div class="hidden md:block bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
		<!-- Table Header / Toolbar -->
		<div class="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
			<div>
				<h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Harvest Register</h2>
				<p class="text-[11px] text-slate-400 mt-0.5">All logged harvests for your farm</p>
			</div>
			
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
				<!-- Date Filter -->
				<select
					bind:value={dateFilter}
					class="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary-green bg-white text-slate-600 cursor-pointer"
				>
					<option value="All">📅 All Dates</option>
					<option value="Today">Today</option>
					<option value="Yesterday">Yesterday</option>
					<option value="This Week">This Week</option>
					<option value="Previous Week">Previous Week</option>
					<option value="This Month">This Month</option>
					<option value="Previous Month">Previous Month</option>
					<option value="This Quarter">This Quarter</option>
					<option value="Previous Quarter">Previous Quarter</option>
					<option value="This Half Year">This Half Year</option>
					<option value="Previous Half Year">Previous Half Year</option>
					<option value="This Year">This Year</option>
					<option value="Previous Year">Previous Year</option>
					<option value="Custom Date Range">Custom Date Range…</option>
				</select>

				<!-- Search input -->
				<div class="relative w-full sm:w-64">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
					<input
						type="text"
						placeholder="Search crop, grade, status…"
						bind:value={searchQuery}
						class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary-green bg-slate-50 focus:bg-white transition-colors"
					/>
				</div>

				<span class="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-1 text-center whitespace-nowrap">
					{harvests.length} {harvests.length === 1 ? 'log' : 'logs'}
				</span>
			</div>
		</div>

		<!-- Custom Date Range Pickers -->
		{#if dateFilter === 'Custom Date Range'}
			<div class="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/30" transition:slide={{ duration: 150 }}>
				<div class="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
					<span>From:</span>
					<input
						type="date"
						bind:value={customFromDate}
						class="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					/>
				</div>
				<div class="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
					<span>To:</span>
					<input
						type="date"
						bind:value={customToDate}
						class="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					/>
				</div>
			</div>
		{/if}

		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="bg-slate-50/60 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6">Crop</th>
						<th class="p-4">Lifespan</th>
						<th class="p-4">Date</th>
						<th class="p-4">Quantity</th>
						<th class="p-4">Grade</th>
						<th class="p-4">Notes</th>
						<th class="p-4">Status</th>
						<th class="p-4 pr-6 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#each paginatedHarvests as harvest (harvest.id)}
						{@const status = getLifespanStatus(harvest.harvestDate, harvest.lifespan)}
						<tr class="hover:bg-slate-50/40 transition-colors group">
							<!-- Crop Name -->
							<td class="p-4 pl-6">
								<span class="font-bold text-slate-800">{harvest.cropName}</span>
							</td>

							<!-- Lifespan -->
							<td class="p-4">
								{#if harvest.lifespan}
									<span class="text-slate-500 flex items-center gap-1">
										<span class="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
										{harvest.lifespan}
									</span>
								{:else}
									<span class="text-slate-300">—</span>
								{/if}
							</td>

							<!-- Harvest Date -->
							<td class="p-4 text-slate-500">{formatDate(harvest.harvestDate)}</td>

							<!-- Quantity + Unit -->
							<td class="p-4">
								<span class="font-extrabold text-slate-800">{harvest.quantity}</span>
								<span class="text-slate-400 ml-1">{harvest.unit || 'Liters'}</span>
							</td>

							<!-- Quality Grade badge -->
							<td class="p-4">
								<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border {gradeClass(harvest.qualityGrade)}">
									{harvest.qualityGrade}
								</span>
							</td>

							<!-- Notes -->
							<td class="p-4 text-slate-500 max-w-[200px]">
								<span class="line-clamp-1">{harvest.notes || '—'}</span>
							</td>

							<!-- Status -->
							<td class="p-4">
								{#if harvest.status?.toLowerCase() === 'sold'}
									<span
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200"
										title="All stock has been sold or used"
									>
										<span class="material-symbols-outlined text-[11px]">check_circle</span>
										Sold
									</span>
								{:else if status}
									<span
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border {status.classes}"
										title="Next harvest in {status.daysRemaining} day{status.daysRemaining === 1 ? '' : 's'}"
									>
										<span class="material-symbols-outlined text-[11px]">{status.icon}</span>
										{status.label}
									</span>
								{:else}
									<span class="text-slate-300">—</span>
								{/if}
							</td>

							<!-- Actions: edit/delete -->
							<td class="p-4 pr-6">
								<div class="flex items-center justify-end gap-1">
									{#if !(harvest.status?.toLowerCase() === 'sold' || harvest.quantity === 0 || (harvest.soldUsed && harvest.soldUsed > 0))}
										<button
											onclick={() => openEditModal(harvest)}
											class="p-1.5 rounded-lg text-slate-400 hover:text-primary-green hover:bg-emerald-50 transition-colors"
											title="Edit harvest log"
											aria-label="Edit harvest log for {harvest.cropName}"
										>
											<span class="material-symbols-outlined text-[16px]">edit</span>
										</button>
										<button
											onclick={() => confirmDelete(harvest)}
											class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
											title="Delete harvest log"
											aria-label="Delete harvest log for {harvest.cropName}"
										>
											<span class="material-symbols-outlined text-[16px]">delete</span>
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="py-16 px-6">
								<div class="flex flex-col items-center gap-3 text-center">
									<div class="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
										<span class="material-symbols-outlined text-3xl text-slate-300">inventory_2</span>
									</div>
									<div>
										<p class="font-bold text-slate-600 text-sm">No harvests logged yet</p>
										<p class="text-slate-400 text-xs mt-1">Click "Log New Harvest" to record your first yield.</p>
									</div>
									<button
										onclick={openAddModal}
										class="mt-1 bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm hover:shadow-primary-green/30 hover:-translate-y-0.5 transition-all"
									>
										<span class="material-symbols-outlined text-[15px]">add</span>
										Log First Harvest
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Footer / Pagination -->
		<div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-400 text-xs bg-slate-50/50">
			<span>
				{#if sortedHarvests.length > 0}
					Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, sortedHarvests.length)} of {sortedHarvests.length} records
				{:else}
					Showing 0 of 0 records
				{/if}
			</span>

			{#if totalPages > 1}
				<div class="flex items-center gap-1.5 font-bold">
					<button
						type="button"
						disabled={currentPage === 1}
						onclick={() => currentPage = Math.max(1, currentPage - 1)}
						class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold"
					>
						&lt; Prev
					</button>

					{#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum}
						<button
							type="button"
							onclick={() => currentPage = pageNum}
							class="size-8 rounded-lg border transition-colors cursor-pointer {currentPage === pageNum ? 'bg-primary-green text-white border-primary-green' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
						>
							{pageNum}
						</button>
					{/each}

					<button
						type="button"
						disabled={currentPage === totalPages}
						onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
						class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold"
					>
						Next &gt;
					</button>
				</div>
			{/if}
		</div>
	</div>

</section>
