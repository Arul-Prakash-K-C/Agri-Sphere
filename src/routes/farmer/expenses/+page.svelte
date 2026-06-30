<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import Modal from '$lib/components/Modal.svelte';
	import ExportReportButton from '$lib/components/ExportReportButton.svelte';

	let { data } = $props();

	let expenses = $state([]);
	let storages = $state([]);
	let inventory = $state([]);
	$effect(() => {
		expenses = data.expenses || [];
		storages = data.storages || [];
		inventory = data.inventory || [];
	});

	// Category totals calculated reactively
	let fertilizerTotal = $derived(expenses.filter(e => e.category === 'Fertilizer').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let seedTotal = $derived(expenses.filter(e => e.category === 'Seed').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let chemicalsTotal = $derived(expenses.filter(e => e.category === 'Chemicals').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let laborTotal = $derived(expenses.filter(e => e.category === 'Labor').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let waterTotal = $derived(expenses.filter(e => e.category === 'Water').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let electricityTotal = $derived(expenses.filter(e => e.category === 'Electricity').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	// Storage selection states
	let newStorageId = $state('');
	let editStorageId = $state('');

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

	function getStorageAvailableSpace(storage) {
		const occupied = inventory
			.filter(item => item.storageId === storage.id)
			.reduce((sum, item) => sum + convertToUnit(((item.total || 0) - (item.soldUsed || 0)), item.unit, storage.unit), 0);
		
		return Math.max(0, storage.capacity - occupied);
	}

	function getNormalizedCategory(cat) {
		const c = (cat || '').trim().toLowerCase();
		if (c === 'seed') return 'seeds';
		if (c === 'fertilizer') return 'fertilizers';
		return c;
	}

	let newAvailableStorages = $derived(
		storages.filter(s =>
			s.categories &&
			s.categories.map(c => c.toLowerCase()).includes(getNormalizedCategory(newCategory))
		).map(s => {
			const avail = getStorageAvailableSpace(s);
			return {
				...s,
				availableSpace: Math.round(avail * 1000) / 1000
			};
		})
	);

	let editAvailableStorages = $derived(
		storages.filter(s =>
			s.categories &&
			s.categories.map(c => c.toLowerCase()).includes(getNormalizedCategory(editCategory))
		).map(s => {
			const avail = getStorageAvailableSpace(s);
			return {
				...s,
				availableSpace: Math.round(avail * 1000) / 1000
			};
		})
	);

	// Add expense modal state
	let showAddModal = $state(false);

	// Form values
	let newCategory = $state('Fertilizer');
	let newDescription = $state('');
	let newAmount = $state('');
	let newStatus = $state('Pending');
	let newDate = $state(new Date().toISOString().split('T')[0]);

	// New fields for Item Details
	let newItemName = $state('');
	let newItemBrand = $state('');
	let newItemQuantity = $state('');
	let newItemUnit = $state('Kg');
	let newItemCostPerUnit = $state('');
	let newItemNotes = $state('');

	// Edit expense modal state
	let showEditModal = $state(false);
	let editId = $state(null);
	let editCategory = $state('Fertilizer');
	let editDescription = $state('');
	let editAmount = $state('');
	let editStatus = $state('Pending');
	let editDate = $state('');

	// Edit fields for Item Details
	let editItemName = $state('');
	let editItemBrand = $state('');
	let editItemQuantity = $state('');
	let editItemUnit = $state('Kg');
	let editItemCostPerUnit = $state('');
	let editItemNotes = $state('');

	// View details modal state
	let showViewModal = $state(false);
	let selectedExpense = $state(null);

	let loading = $state(false);
	let error = $state('');

	let chartInstance;

	// Helper check for conditional categories
	function isConditionalCategory(cat) {
		return ['Seed', 'Fertilizer', 'Chemicals'].includes(cat);
	}

	onMount(() => {
		const interval = setInterval(() => {
			if (typeof Chart !== 'undefined') {
				clearInterval(interval);
				initChart();
			}
		}, 100);

		return () => {
			clearInterval(interval);
			chartInstance?.destroy();
		};
	});

	function initChart() {
		const ctx = document.getElementById('expenseTrendChart')?.getContext('2d');
		if (ctx) {
			if (chartInstance) chartInstance.destroy();

			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const now = new Date();
			const last6Months = [];
			const dataPoints = [];
			
			for (let i = 5; i >= 0; i--) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				last6Months.push(months[d.getMonth()]);
				
				const sum = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);
				dataPoints.push(sum);
			}

			chartInstance = new Chart(ctx, {
				type: 'line',
				data: {
					labels: last6Months,
					datasets: [
						{
							label: 'Operational Expenses (₹)',
							data: dataPoints,
							borderColor: '#006b2c', // primary-green
							backgroundColor: 'rgba(22, 163, 74, 0.05)',
							borderWidth: 3,
							tension: 0.4,
							fill: true,
							pointBackgroundColor: '#ffffff',
							pointBorderColor: '#006b2c',
							pointRadius: 6,
							pointHoverRadius: 8
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false }
					},
					scales: {
						y: {
							beginAtZero: false,
							grid: { color: 'rgba(226, 226, 226, 0.3)' }
						},
						x: {
							grid: { display: false }
						}
					}
				}
			});
		}
	}

	async function handleAddExpense(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const payload = {
			category: newCategory,
			description: newDescription,
			amount: Number(newAmount),
			status: newStatus,
			date: newDate
		};

		if (isConditionalCategory(newCategory)) {
			if (!newStorageId) {
				error = 'Please select a storage location.';
				loading = false;
				return;
			}
			const storage = storages.find(s => s.id === newStorageId);
			if (storage) {
				const avail = getStorageAvailableSpace(storage);
				const quantityInStorageUnit = convertToUnit(Number(newItemQuantity), newItemUnit, storage.unit);
				if (quantityInStorageUnit > avail) {
					error = `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}. Required: ${Math.round(quantityInStorageUnit * 100) / 100} ${storage.unit}.`;
					loading = false;
					return;
				}
			}

			payload.itemDetails = {
				itemName: newItemName,
				brand: newItemBrand,
				quantity: Number(newItemQuantity),
				unit: newItemUnit,
				costPerUnit: newItemCostPerUnit ? Number(newItemCostPerUnit) : null,
				notes: newItemNotes,
				storageId: newStorageId
			};
		}

		try {
			const res = await fetch('/api/expenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to log expense');
			}

			const addedExpense = await res.json();
			expenses = [addedExpense, ...expenses];

			if (chartInstance) {
				initChart();
			}

			// Reset form
			newCategory = 'Fertilizer';
			newDescription = '';
			newAmount = '';
			newStatus = 'Pending';
			newDate = new Date().toISOString().split('T')[0];
			
			newItemName = '';
			newItemBrand = '';
			newItemQuantity = '';
			newItemUnit = 'Kg';
			newItemCostPerUnit = '';
			newItemNotes = '';
			newStorageId = '';

			showAddModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteExpense(id, amount) {
		if (!confirm('Are you sure you want to delete this expense?')) return;
		try {
			const res = await fetch(`/api/expenses/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete expense');
			}

			expenses = expenses.filter(e => e.id !== id);
			if (chartInstance) {
				initChart();
			}
		} catch (err) {
			alert(err.message);
		}
	}

	function openEditModal(expense) {
		editId = expense.id;
		editCategory = expense.category;
		editDescription = expense.description;
		editAmount = expense.amount;
		editStatus = expense.status;
		
		try {
			editDate = expense.rawDate ? expense.rawDate.split('T')[0] : new Date(expense.date).toISOString().split('T')[0];
		} catch (e) {
			editDate = new Date().toISOString().split('T')[0];
		}

		if (expense.itemDetails) {
			editItemName = expense.itemDetails.itemName || '';
			editItemBrand = expense.itemDetails.brand || '';
			editItemQuantity = expense.itemDetails.quantity || '';
			editItemUnit = expense.itemDetails.unit || 'Kg';
			editItemCostPerUnit = expense.itemDetails.costPerUnit || '';
			editItemNotes = expense.itemDetails.notes || '';
			editStorageId = expense.itemDetails.storageId || '';
		} else {
			editItemName = '';
			editItemBrand = '';
			editItemQuantity = '';
			editItemUnit = 'Kg';
			editItemCostPerUnit = '';
			editItemNotes = '';
			editStorageId = '';
		}
		
		showEditModal = true;
	}

	async function handleEditExpense(event) {
		event.preventDefault();
		loading = true;
		error = '';

		const payload = {
			category: editCategory,
			description: editDescription,
			amount: Number(editAmount),
			status: editStatus,
			date: editDate
		};

		if (isConditionalCategory(editCategory)) {
			if (!editStorageId) {
				error = 'Please select a storage location.';
				loading = false;
				return;
			}
			const storage = storages.find(s => s.id === editStorageId);
			if (storage) {
				const avail = getStorageAvailableSpace(storage);
				const quantityInStorageUnit = convertToUnit(Number(editItemQuantity), editItemUnit, storage.unit);
				if (quantityInStorageUnit > avail) {
					error = `Not enough storage space. Available space: ${Math.round(avail * 100) / 100} ${storage.unit}. Required: ${Math.round(quantityInStorageUnit * 100) / 100} ${storage.unit}.`;
					loading = false;
					return;
				}
			}

			payload.itemDetails = {
				itemName: editItemName,
				brand: editItemBrand,
				quantity: Number(editItemQuantity),
				unit: editItemUnit,
				costPerUnit: editItemCostPerUnit ? Number(editItemCostPerUnit) : null,
				notes: editItemNotes,
				storageId: editStorageId
			};
		}

		try {
			const res = await fetch(`/api/expenses/${editId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to update expense');
			}

			const updatedExpense = await res.json();
			expenses = expenses.map(e => e.id === editId ? updatedExpense : e);

			if (chartInstance) {
				initChart();
			}

			showEditModal = false;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function openViewModal(expense) {
		selectedExpense = expense;
		showViewModal = true;
	}
</script>

<svelte:head>
	<title>Expense Management - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Expense Overview</h1>
			<p class="text-sm text-slate-500 mt-1">Track and manage your agricultural operational costs.</p>
		</div>
		<div class="flex items-center gap-3">
			<ExportReportButton 
				reportType="expenses" 
				dataList={expenses} 
				customClass="rounded-full px-5 py-3"
			/>
			<button 
				onclick={() => showAddModal = true}
				class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
			>
				<span class="material-symbols-outlined text-[18px]">add</span>
				<span>Add Expense</span>
			</button>
		</div>
	</div>	<!-- Add Expense Modal -->
	<Modal bind:show={showAddModal} size="md" title="Log New Expense" onSubmit={handleAddExpense}>
		<div class="space-y-4 text-xs font-semibold text-slate-700">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Category</span>
					<select bind:value={newCategory} class="input-field w-full text-xs bg-white py-[9.5px]">
						<option value="Seed">Seed</option>
						<option value="Fertilizer">Fertilizer</option>
						<option value="Chemicals">Chemicals</option>
						<option value="Labor">Labor</option>
						<option value="Water">Water</option>
						<option value="Electricity">Electricity</option>
					</select>
				</label>
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Status</span>
					<select bind:value={newStatus} class="input-field w-full text-xs bg-white py-[9.5px]">
						<option value="Pending">Pending</option>
						<option value="Completed">Completed</option>
					</select>
				</label>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Amount (₹)</span>
					<input type="number" step="0.01" bind:value={newAmount} required placeholder="0.00" class="input-field w-full text-xs" />
				</label>
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Date</span>
					<input type="date" bind:value={newDate} required class="input-field w-full text-xs bg-white py-[7.5px]" />
				</label>
			</div>

			<label class="block">
				<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Description</span>
				<input type="text" bind:value={newDescription} required placeholder="e.g. Purchase order" class="input-field w-full text-xs" />
			</label>

			<!-- Item Details Section (Conditional) -->
			{#if isConditionalCategory(newCategory)}
				<div transition:slide={{ duration: 200 }} class="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
					<h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
						<span class="material-symbols-outlined text-[16px] text-primary-green">inventory</span>
						Item Details ({newCategory})
					</h4>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Item Name <span class="text-red-500">*</span></span>
							<input type="text" bind:value={newItemName} required placeholder="e.g. Potassium Nitrate" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Brand/Manufacturer</span>
							<input type="text" bind:value={newItemBrand} placeholder="Optional" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Quantity <span class="text-red-500">*</span></span>
							<input type="number" step="any" bind:value={newItemQuantity} required placeholder="e.g. 50" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Unit <span class="text-red-500">*</span></span>
							<select bind:value={newItemUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Kg">Kg</option>
								<option value="Liters">Liters</option>
								<option value="Packets">Packets</option>
								<option value="Bags">Bags</option>
								<option value="Units">Units</option>
							</select>
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Cost per Unit</span>
							<input type="number" step="0.01" bind:value={newItemCostPerUnit} placeholder="Optional" class="input-field w-full text-xs" />
						</label>
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Notes</span>
							<input type="text" bind:value={newItemNotes} placeholder="Optional item notes" class="input-field w-full text-xs" />
						</label>
						<!-- Storage Location selector -->
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
								Storage Location <span class="text-red-500">*</span>
							</span>
							<select
								bind:value={newStorageId}
								required
								class="input-field w-full text-xs bg-white py-[9.5px] disabled:opacity-60 disabled:cursor-not-allowed"
							>
								<option value="" disabled>— Select storage location —</option>
								{#each newAvailableStorages as storage (storage.id)}
									<option value={storage.id}>{storage.name} (Available: {storage.availableSpace} {storage.unit} / Capacity: {storage.capacity} {storage.unit})</option>
								{:else}
									<option value="" disabled>No storages configured for {newCategory}</option>
								{/each}
							</select>
							{#if newAvailableStorages.length === 0}
								<p class="text-[10px] text-amber-600 mt-1 font-bold">
									⚠️ Configure a storage for "{newCategory}" in the Inventory module first.
								</p>
							{/if}
						</label>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
					⚠️ {error}
				</div>
			{/if}
		</div>

		{#snippet footer()}
			<button 
				type="button" 
				onclick={() => showAddModal = false}
				class="btn-secondary flex-1 py-3 text-xs cursor-pointer"
			>
				Cancel
			</button>
			<button 
				type="submit" 
				class="btn-primary flex-1 py-3 text-xs cursor-pointer"
				disabled={loading}
			>
				{loading ? 'Logging...' : 'Log Expense'}
			</button>
		{/snippet}
	</Modal>

	<!-- Edit Expense Modal -->
	<Modal bind:show={showEditModal} size="md" title="Edit Expense" onSubmit={handleEditExpense}>
		<div class="space-y-4 text-xs font-semibold text-slate-700">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Category</span>
					<select bind:value={editCategory} class="input-field w-full text-xs bg-white py-[9.5px]">
						<option value="Seed">Seed</option>
						<option value="Fertilizer">Fertilizer</option>
						<option value="Chemicals">Chemicals</option>
						<option value="Labor">Labor</option>
						<option value="Water">Water</option>
						<option value="Electricity">Electricity</option>
					</select>
				</label>
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Status</span>
					<select bind:value={editStatus} class="input-field w-full text-xs bg-white py-[9.5px]">
						<option value="Pending">Pending</option>
						<option value="Completed">Completed</option>
					</select>
				</label>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Amount (₹)</span>
					<input type="number" step="0.01" bind:value={editAmount} required placeholder="0.00" class="input-field w-full text-xs" />
				</label>
				<label class="block">
					<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Date</span>
					<input type="date" bind:value={editDate} required class="input-field w-full text-xs bg-white py-[7.5px]" />
				</label>
			</div>

			<label class="block">
				<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Description</span>
				<input type="text" bind:value={editDescription} required class="input-field w-full text-xs" />
			</label>

			<!-- Item Details Section (Conditional for Edit) -->
			{#if isConditionalCategory(editCategory)}
				<div transition:slide={{ duration: 200 }} class="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
					<h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
						<span class="material-symbols-outlined text-[16px] text-primary-green">inventory</span>
						Item Details ({editCategory})
					</h4>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Item Name <span class="text-red-500">*</span></span>
							<input type="text" bind:value={editItemName} required placeholder="e.g. Potassium Nitrate" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Brand/Manufacturer</span>
							<input type="text" bind:value={editItemBrand} placeholder="Optional" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Quantity <span class="text-red-500">*</span></span>
							<input type="number" step="any" bind:value={editItemQuantity} required placeholder="e.g. 50" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Unit <span class="text-red-500">*</span></span>
							<select bind:value={editItemUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Kg">Kg</option>
								<option value="Liters">Liters</option>
								<option value="Packets">Packets</option>
								<option value="Bags">Bags</option>
								<option value="Units">Units</option>
							</select>
						</label>
						<label class="block">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Cost per Unit</span>
							<input type="number" step="0.01" bind:value={editItemCostPerUnit} placeholder="Optional" class="input-field w-full text-xs" />
						</label>
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Notes</span>
							<input type="text" bind:value={editItemNotes} placeholder="Optional item notes" class="input-field w-full text-xs" />
						</label>
						<!-- Storage Location selector -->
						<label class="block sm:col-span-2">
							<span class="block mb-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
								Storage Location <span class="text-red-500">*</span>
							</span>
							<select
								bind:value={editStorageId}
								required
								class="input-field w-full text-xs bg-white py-[9.5px] disabled:opacity-60 disabled:cursor-not-allowed"
							>
								<option value="" disabled>— Select storage location —</option>
								{#each editAvailableStorages as storage (storage.id)}
									<option value={storage.id}>{storage.name} (Available: {storage.availableSpace} {storage.unit} / Capacity: {storage.capacity} {storage.unit})</option>
								{:else}
									<option value="" disabled>No storages configured for {editCategory}</option>
								{/each}
							</select>
							{#if editAvailableStorages.length === 0}
								<p class="text-[10px] text-amber-600 mt-1 font-bold">
									⚠️ Configure a storage for "{editCategory}" in the Inventory module first.
								</p>
							{/if}
						</label>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
					⚠️ {error}
				</div>
			{/if}
		</div>

		{#snippet footer()}
			<button 
				type="button" 
				onclick={() => showEditModal = false}
				class="btn-secondary flex-1 py-3 text-xs cursor-pointer"
			>
				Cancel
			</button>
			<button 
				type="submit" 
				class="btn-primary flex-1 py-3 text-xs cursor-pointer"
				disabled={loading}
			>
				{loading ? 'Saving...' : 'Save Changes'}
			</button>
		{/snippet}
	</Modal>

	<!-- View Details Modal -->
	<Modal bind:show={showViewModal} size="md" title="Expense Details">
		{#if selectedExpense}
			<div class="space-y-4 text-xs font-semibold text-slate-700">
				<div class="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
					<div>
						<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Category</span>
						<span class="text-slate-800 font-extrabold text-sm">{selectedExpense.category}</span>
					</div>
					<div>
						<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Date</span>
						<span class="text-slate-800 text-sm">{selectedExpense.date}</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
					<div>
						<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Amount</span>
						<span class="text-slate-800 font-extrabold text-sm">₹{selectedExpense.amount.toLocaleString()}</span>
					</div>
					<div>
						<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Status</span>
						<span class={['px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block mt-0.5', selectedExpense.statusColor].join(' ')}>
							{selectedExpense.status}
						</span>
					</div>
				</div>

				<div class="border-b border-slate-100 pb-3">
					<span class="block mb-1 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Description</span>
					<span class="text-slate-800 text-sm font-normal block mt-0.5">{selectedExpense.description}</span>
				</div>

				<!-- Item Details Section -->
				{#if selectedExpense.itemDetails}
					<div class="p-4 bg-slate-50 rounded-xl border border-slate-200/50 space-y-2.5">
						<h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/30 pb-2">
							<span class="material-symbols-outlined text-[16px] text-primary-green">inventory</span>
							Item Specifications
						</h4>
						<div class="grid grid-cols-2 gap-2 text-[11px]">
							<div>
								<span class="text-slate-400 block text-[9px] uppercase font-bold">Item Name</span>
								<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.itemName}</span>
							</div>
							<div>
								<span class="text-slate-400 block text-[9px] uppercase font-bold">Brand</span>
								<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.brand || 'N/A'}</span>
							</div>
							<div>
								<span class="text-slate-400 block text-[9px] uppercase font-bold">Quantity</span>
								<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.quantity} {selectedExpense.itemDetails.unit}</span>
							</div>
							<div>
								<span class="text-slate-400 block text-[9px] uppercase font-bold">Cost per Unit</span>
								<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.costPerUnit ? '₹' + selectedExpense.itemDetails.costPerUnit : 'N/A'}</span>
							</div>
							{#if selectedExpense.itemDetails.notes}
								<div class="col-span-2">
									<span class="text-slate-400 block text-[9px] uppercase font-bold">Item Notes</span>
									<span class="text-slate-800 font-normal block">{selectedExpense.itemDetails.notes}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#snippet footer()}
			<button 
				type="button" 
				onclick={() => { showViewModal = false; selectedExpense = null; }}
				class="btn-primary w-full py-3 text-xs cursor-pointer"
			>
				Dismiss
			</button>
		{/snippet}
	</Modal>

	<!-- Dashboard Bento Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		<!-- Chart Area (Left) -->
		<div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200/50 p-6 shadow-sm flex flex-col h-[400px]">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Monthly Trends</h3>
				<span class="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3.5 py-1">Operational Cost</span>
			</div>
			<div class="flex-grow relative">
				<canvas id="expenseTrendChart"></canvas>
			</div>
		</div>

		<!-- Category Cards (Right) -->
		<div class="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
			<!-- Seed -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-emerald-50 text-primary-green rounded-xl group-hover:bg-emerald-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">grass</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seed</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{seedTotal.toLocaleString()}</p>
				</div>
			</div>
			<!-- Fertilizer -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-emerald-50 text-primary-green rounded-xl group-hover:bg-emerald-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">compost</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fertilizer</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{fertilizerTotal.toLocaleString()}</p>
				</div>
			</div>
			<!-- Chemicals -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-blue-50 text-blue-650 rounded-xl group-hover:bg-blue-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">science</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chemicals</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{chemicalsTotal.toLocaleString()}</p>
				</div>
			</div>
			<!-- Labor -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:bg-amber-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">engineering</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labor</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{laborTotal.toLocaleString()}</p>
				</div>
			</div>
			<!-- Water -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-emerald-50 text-dark-green rounded-xl group-hover:bg-emerald-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">water_drop</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Water</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{waterTotal.toLocaleString()}</p>
				</div>
			</div>
			<!-- Electricity -->
			<div class="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 group">
				<div class="p-3 bg-red-50 text-red-500 rounded-xl group-hover:bg-red-100 transition-colors">
					<span class="material-symbols-outlined text-2xl">bolt</span>
				</div>
				<div>
					<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Electricity</p>
					<p class="text-lg font-black text-slate-800 mt-0.5">₹{electricityTotal.toLocaleString()}</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Expenses Table -->
	<div class="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
		<div class="p-5 border-b border-slate-100 flex justify-between items-center">
			<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Expenses Logs</h3>
			<span class="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-0.5">{expenses.length} logs saved</span>
		</div>
		<div class="w-full">
			<table class="w-full text-left border-collapse text-xs table-fixed min-w-0">
				<thead>
					<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6 w-[22%] sm:w-[15%] hidden sm:table-cell">Date</th>
						<th class="p-4 pl-6 sm:pl-4 w-[50%] sm:w-[22%]">Category</th>
						<th class="p-4 w-[25%] sm:w-[25%] hidden sm:table-cell">Description</th>
						<th class="p-4 text-right pr-6 sm:pr-4 w-[35%] sm:w-[15%]">Amount</th>
						<th class="p-4 w-[15%] hidden sm:table-cell">Status</th>
						<th class="p-4 pr-6 text-center w-[15%] hidden sm:table-cell">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#if loading}
						{#each Array(2) as _}
							<tr class="animate-pulse border-b border-slate-50">
								<td class="p-4 pl-6 hidden sm:table-cell"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4 pl-6 sm:pl-4"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4 hidden sm:table-cell"><div class="skeleton h-4 w-32 rounded"></div></td>
								<td class="p-4 text-right pr-6 sm:pr-4"><div class="skeleton h-4 w-16 rounded ml-auto"></div></td>
								<td class="p-4 hidden sm:table-cell"><div class="skeleton h-4 w-16 rounded"></div></td>
								<td class="p-4 pr-6 text-center hidden sm:table-cell"><div class="skeleton h-4 w-14 rounded mx-auto"></div></td>
							</tr>
						{/each}
					{/if}
					{#each expenses as expense (expense.id)}
						<tr class="hover:bg-slate-50/30 transition-colors">
							<td class="p-4 pl-6 text-slate-400 hidden sm:table-cell">{expense.date}</td>
							<td class="p-4 pl-6 sm:pl-4 w-[50%] sm:w-auto">
								<div class="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
									<span>{expense.category}</span>
									{#if expense.itemDetails}
										<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary-green" title="Has Item Details"></span>
									{/if}
								</div>
								<div class="sm:hidden text-[9px] text-slate-400 font-semibold space-y-0.5 mt-1">
									{#if expense.description}
										<p class="text-slate-500 font-medium">{expense.description}</p>
									{/if}
									<p>Date: {expense.date} • <span class={expense.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}>{expense.status}</span></p>
									<!-- Mobile Action Buttons -->
									<div class="flex items-center gap-3 pt-1.5">
										<button 
											onclick={() => openViewModal(expense)}
											class="text-slate-400 hover:text-slate-650 transition-colors py-0.5 flex items-center gap-0.5"
											title="View Details"
										>
											<span class="material-symbols-outlined text-[14px]">visibility</span>
											<span>View</span>
										</button>
										<button 
											onclick={() => openEditModal(expense)}
											class="text-primary-green hover:text-dark-green transition-colors py-0.5 flex items-center gap-0.5"
											title="Edit"
										>
											<span class="material-symbols-outlined text-[14px]">edit</span>
											<span>Edit</span>
										</button>
										<button 
											onclick={() => handleDeleteExpense(expense.id, expense.amount)}
											class="text-red-500 hover:text-red-700 transition-colors py-0.5 flex items-center gap-0.5"
											title="Delete"
										>
											<span class="material-symbols-outlined text-[14px]">delete</span>
											<span>Delete</span>
										</button>
									</div>
								</div>
							</td>
							<td class="p-4 text-slate-500 hidden sm:table-cell">{expense.description}</td>
							<td class="p-4 text-right pr-6 sm:pr-4 font-extrabold text-slate-800 w-[35%] sm:w-auto">
								₹{expense.amount.toFixed(2)}
							</td>
							<td class="p-4 hidden sm:table-cell">
								<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', expense.statusColor].filter(Boolean).join(' ')}>
									{expense.status}
								</span>
							</td>
							<td class="p-4 pr-6 text-center hidden sm:table-cell">
								<div class="flex items-center justify-center gap-1">
									<button 
										onclick={() => openViewModal(expense)}
										class="text-slate-400 hover:text-slate-650 transition-colors p-1"
										title="View Details"
									>
										<span class="material-symbols-outlined text-[18px]">visibility</span>
									</button>
									<button 
										onclick={() => openEditModal(expense)}
										class="text-primary-green hover:text-dark-green transition-colors p-1"
										title="Edit"
									>
										<span class="material-symbols-outlined text-[18px]">edit</span>
									</button>
									<button 
										onclick={() => handleDeleteExpense(expense.id, expense.amount)}
										class="text-red-500 hover:text-red-700 transition-colors p-1"
										title="Delete"
									>
										<span class="material-symbols-outlined text-[18px]">delete</span>
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
