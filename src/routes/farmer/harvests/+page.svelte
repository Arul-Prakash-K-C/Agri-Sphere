<script>
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	// ─── State ────────────────────────────────────────────────────────────────
	let harvests = $state([]);
	let crops    = $state([]);

	$effect(() => {
		harvests = data.harvests || [];
		crops    = data.crops    || [];
	});

	// Modal visibility
	let showFormModal    = $state(false);
	let showDeleteDialog = $state(false);

	// Form mode: 'add' | 'edit'
	let formMode = $state('add');

	// The harvest being edited (null in add mode)
	let editingHarvest = $state(null);

	// The harvest pending deletion
	let harvestToDelete = $state(null);

	// ─── Form fields ──────────────────────────────────────────────────────────
	let selectedCropId   = $state('');   // '' = new crop; '__new__' = add new crop sentinel
	let newCropName      = $state('');
	let newCropLifespan  = $state('');   // only used when adding a new crop
	let lifespan         = $state('');   // auto-filled from existing crop, editable for new
	let quantity         = $state('');
	let unit             = $state('Liters');
	let harvestDate      = $state(new Date().toISOString().split('T')[0]);
	let qualityGrade     = $state('Grade A');
	let notes            = $state('');

	// Inline new-crop mini-form toggle
	let showNewCropForm = $derived(selectedCropId === '__new__');

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
		newCropName      = '';
		newCropLifespan  = '';
		lifespan         = harvest.lifespan || '';
		quantity         = String(harvest.quantity);
		unit             = harvest.unit || 'Liters';
		harvestDate      = harvest.harvestDate || new Date().toISOString().split('T')[0];
		qualityGrade     = harvest.qualityGrade || 'Grade A';
		notes            = harvest.notes || '';
		showFormModal    = true;
		error            = '';
	}

	function confirmDelete(harvest) {
		harvestToDelete  = harvest;
		showDeleteDialog = true;
	}

	function closeFormModal() {
		showFormModal  = false;
		editingHarvest = null;
		resetForm();
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		harvestToDelete  = null;
	}

	function resetForm() {
		selectedCropId  = '';
		newCropName     = '';
		newCropLifespan = '';
		lifespan        = '';
		quantity        = '';
		unit            = 'Liters';
		harvestDate     = new Date().toISOString().split('T')[0];
		qualityGrade    = 'Grade A';
		notes           = '';
		error           = '';
	}

	// ─── Auto-fill lifespan from selected crop ───────────────────────────────
	function onCropChange() {
		if (selectedCropId && selectedCropId !== '__new__') {
			const crop = crops.find(c => c.id === selectedCropId);
			lifespan = crop?.harvestDuration || '';
		} else if (selectedCropId === '__new__') {
			lifespan = newCropLifespan;
		} else {
			lifespan = '';
		}
	}

	// ─── Resolve crop name for submission ─────────────────────────────────────
	function resolvedCropName() {
		if (selectedCropId === '__new__') return newCropName.trim();
		const crop = crops.find(c => c.id === selectedCropId);
		return crop?.name || '';
	}

	// ─── Add new crop inline, then re-select it ───────────────────────────────
	async function createNewCrop() {
		if (!newCropName.trim() || !newCropLifespan.trim()) {
			error = 'New crop requires a name and lifespan.';
			return null;
		}
		const res = await fetch('/api/crops', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: newCropName.trim(),
				location: 'Unspecified',
				plantedDate: new Date().toISOString().split('T')[0],
				harvestDuration: newCropLifespan.trim(),
				acres: 1
			})
		});
		if (!res.ok) {
			const d = await res.json();
			throw new Error(d.error || 'Failed to create crop');
		}
		const created = await res.json();
		crops = [...crops, created];
		return created;
	}

	// ─── Submit: Add harvest ──────────────────────────────────────────────────
	async function handleAddHarvest(event) {
		event.preventDefault();
		loading = true;
		error   = '';

		try {
			let cropId  = selectedCropId === '__new__' ? '' : selectedCropId;
			let cropName = resolvedCropName();
			let finalLifespan = lifespan;

			// Create new crop first if needed
			if (selectedCropId === '__new__') {
				const created = await createNewCrop();
				if (!created) { loading = false; return; }
				cropId       = created.id;
				cropName     = created.name;
				finalLifespan = created.harvestDuration;
				// Update dropdown to point to newly created crop
				selectedCropId = created.id;
				lifespan       = created.harvestDuration;
			}

			if (!cropName) { error = 'Please select or enter a crop.'; loading = false; return; }

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
					notes
				})
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to log harvest');
			}

			const added = await res.json();
			harvests    = [added, ...harvests];
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
			let cropId   = selectedCropId === '__new__' ? '' : selectedCropId;
			let cropName = resolvedCropName();
			let finalLifespan = lifespan;

			if (selectedCropId === '__new__') {
				const created = await createNewCrop();
				if (!created) { loading = false; return; }
				cropId        = created.id;
				cropName      = created.name;
				finalLifespan = created.harvestDuration;
				selectedCropId = created.id;
				lifespan       = created.harvestDuration;
			}

			if (!cropName) { error = 'Please select or enter a crop.'; loading = false; return; }

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
					notes
				})
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to update harvest');
			}

			const updated = await res.json();
			harvests = harvests.map(h => h.id === updated.id ? updated : h);
			closeFormModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// ─── Delete harvest ───────────────────────────────────────────────────────
	async function handleDeleteHarvest() {
		if (!harvestToDelete) return;
		deleteLoading = true;

		try {
			const res = await fetch('/api/harvests/' + harvestToDelete.id, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to delete harvest');
			}

			harvests = harvests.filter(h => h.id !== harvestToDelete.id);
			closeDeleteDialog();
		} catch (err) {
			alert(err.message);
		} finally {
			deleteLoading = false;
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
	<title>Harvest Logs — AgriConnect</title>
	<meta name="description" content="Record, manage, and track your farm harvest yields and product quality." />
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">

	<!-- ── Page Header ────────────────────────────────────────────────────── -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Harvest Logs</h1>
			<p class="text-sm text-slate-500 mt-1">Record and track your farm yields and product quality.</p>
		</div>
		<button
			onclick={openAddModal}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/40 hover:-translate-y-0.5 transition-all whitespace-nowrap"
		>
			<span class="material-symbols-outlined text-[18px]">add_circle</span>
			<span>Log New Harvest</span>
		</button>
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
					<div>
						<label for="harvest-crop" class="block mb-1.5 font-bold text-slate-700">
							Crop <span class="text-red-500">*</span>
						</label>
						<select
							id="harvest-crop"
							bind:value={selectedCropId}
							onchange={onCropChange}
							required={!showNewCropForm}
							class="input-field w-full text-xs bg-white py-[9.5px]"
						>
							<option value="" disabled>— Select a crop —</option>
							{#each crops as crop (crop.id)}
								<option value={crop.id}>{crop.name}</option>
							{/each}
							<option value="__new__">➕ Add new crop…</option>
						</select>
					</div>

					<!-- ── Inline New Crop Form ───────────────────────────── -->
					{#if showNewCropForm}
						<div
							transition:slide={{ duration: 150 }}
							class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3"
						>
							<p class="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[14px]">eco</span>
								Register new crop
							</p>
							<div class="grid grid-cols-2 gap-3">
								<label class="block col-span-2">
									<span class="block mb-1 text-slate-600">Crop Name <span class="text-red-500">*</span></span>
									<input
										type="text"
										bind:value={newCropName}
										placeholder="e.g. Dragon Fruit"
										class="input-field w-full text-xs"
									/>
								</label>
								<label class="block col-span-2">
									<span class="block mb-1 text-slate-600">Lifespan <span class="text-red-500">*</span></span>
									<input
										type="text"
										bind:value={newCropLifespan}
										placeholder="e.g. 90 Days or Seasonal (Jun, Jul)"
										class="input-field w-full text-xs"
										oninput={() => lifespan = newCropLifespan}
									/>
									<span class="text-[10px] text-slate-400 mt-1 block">Will be saved to Crops module automatically.</span>
								</label>
							</div>
						</div>
					{/if}

					<!-- ── Lifespan (always editable — auto-filled as a starting point) ──── -->
					<div>
						<label for="harvest-lifespan" class="block mb-1.5 font-bold text-slate-700">
							Lifespan
							{#if selectedCropId && selectedCropId !== '__new__'}
								<span class="ml-1 text-[10px] font-normal text-slate-400">(auto-filled · editable)</span>
							{/if}
						</label>
						<input
							id="harvest-lifespan"
							type="text"
							bind:value={lifespan}
							placeholder="e.g. 90 Days or Seasonal (Jun, Jul)"
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

	<!-- ── Delete Confirmation Dialog ─────────────────────────────────────── -->
	{#if showDeleteDialog}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			role="alertdialog"
			aria-modal="true"
			aria-label="Confirm harvest deletion"
		>
			<div
				transition:slide={{ duration: 200 }}
				class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4"
			>
				<div class="flex items-start gap-4">
					<div class="size-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
						<span class="material-symbols-outlined text-red-600 text-xl">delete_forever</span>
					</div>
					<div>
						<h3 class="font-extrabold text-slate-800 text-sm">Delete Harvest Log?</h3>
						<p class="text-xs text-slate-500 mt-1 leading-relaxed">
							This will permanently delete the harvest log for
							<strong class="text-slate-700">{harvestToDelete?.cropName}</strong>
							({harvestToDelete?.harvestDate}) and remove the linked inventory record.
						</p>
					</div>
				</div>
				<div class="flex gap-3">
					<button
						type="button"
						onclick={closeDeleteDialog}
						class="btn-secondary flex-1 py-2.5 text-xs"
						disabled={deleteLoading}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleDeleteHarvest}
						disabled={deleteLoading}
						class="flex-1 py-2.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{#if deleteLoading}
							<span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
							Deleting…
						{:else}
							<span class="material-symbols-outlined text-[15px]">delete</span>
							Delete Log
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- ── Harvest Table ────────────────────────────────────────────────────── -->
	<div class="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
		<!-- Table Header -->
		<div class="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Harvest Register</h2>
				<p class="text-[11px] text-slate-400 mt-0.5">All logged harvests for your farm</p>
			</div>
			<span class="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-1 self-start sm:self-auto">
				{harvests.length} {harvests.length === 1 ? 'log' : 'logs'}
			</span>
		</div>

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
						<th class="p-4 pr-6 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#each harvests as harvest (harvest.id)}
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

							<!-- Actions: status badge + edit/delete -->
							<td class="p-4 pr-6">
								<div class="flex items-center justify-end gap-2">
									{#if status}
										<span
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border {status.classes}"
											title="Next harvest in {status.daysRemaining} day{status.daysRemaining === 1 ? '' : 's'}"
										>
											<span class="material-symbols-outlined text-[11px]">{status.icon}</span>
											{status.label}
										</span>
									{/if}
									<!-- Edit / Delete (appear on row hover) -->
									<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
									</div>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="py-16 px-6">
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
	</div>

</section>
