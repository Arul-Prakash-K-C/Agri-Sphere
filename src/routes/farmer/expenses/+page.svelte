<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	let expenses = $state([]);
	$effect(() => {
		expenses = data.expenses || [];
	});

	// Category totals calculated reactively
	let fertilizerTotal = $derived(expenses.filter(e => e.category === 'Fertilizer').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let seedTotal = $derived(expenses.filter(e => e.category === 'Seed').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let chemicalsTotal = $derived(expenses.filter(e => e.category === 'Chemicals').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let laborTotal = $derived(expenses.filter(e => e.category === 'Labor').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let waterTotal = $derived(expenses.filter(e => e.category === 'Water').reduce((sum, e) => sum + Number(e.amount || 0), 0));
	let electricityTotal = $derived(expenses.filter(e => e.category === 'Electricity').reduce((sum, e) => sum + Number(e.amount || 0), 0));

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
			payload.itemDetails = {
				itemName: newItemName,
				brand: newItemBrand,
				quantity: Number(newItemQuantity),
				unit: newItemUnit,
				costPerUnit: newItemCostPerUnit ? Number(newItemCostPerUnit) : null,
				notes: newItemNotes
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
		} else {
			editItemName = '';
			editItemBrand = '';
			editItemQuantity = '';
			editItemUnit = 'Kg';
			editItemCostPerUnit = '';
			editItemNotes = '';
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
			payload.itemDetails = {
				itemName: editItemName,
				brand: editItemBrand,
				quantity: Number(editItemQuantity),
				unit: editItemUnit,
				costPerUnit: editItemCostPerUnit ? Number(editItemCostPerUnit) : null,
				notes: editItemNotes
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
		<button 
			onclick={() => showAddModal = true}
			class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-5 py-3 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap"
		>
			<span class="material-symbols-outlined text-[18px]">add</span>
			<span>Add Expense</span>
		</button>
	</div>

	<!-- Add Expense Modal -->
	{#if showAddModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base font-headline-md">Log New Expense</h3>
					<button onclick={() => showAddModal = false} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleAddExpense} class="mt-4 space-y-4 text-xs font-semibold text-slate-700 max-h-[80vh] overflow-y-auto pr-1">
					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Category</span>
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
							<span class="block mb-1">Status</span>
							<select bind:value={newStatus} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Pending">Pending</option>
								<option value="Completed">Completed</option>
							</select>
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Amount (₹)</span>
							<input type="number" step="0.01" bind:value={newAmount} required placeholder="0.00" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Date</span>
							<input type="date" bind:value={newDate} required class="input-field w-full text-xs" />
						</label>
					</div>

					<label class="block">
						<span class="block mb-1">Description</span>
						<input type="text" bind:value={newDescription} required placeholder="e.g. Purchase order" class="input-field w-full text-xs" />
					</label>

					<!-- Item Details Section (Conditional) -->
					{#if isConditionalCategory(newCategory)}
						<div transition:slide={{ duration: 200 }} class="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
							<h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
								<span class="material-symbols-outlined text-[16px] text-primary-green">inventory</span>
								Item Details ({newCategory})
							</h4>
							<div class="grid grid-cols-2 gap-3">
								<label class="block col-span-2">
									<span class="block mb-1 text-[11px] text-slate-600">Item Name <span class="text-red-500">*</span></span>
									<input type="text" bind:value={newItemName} required placeholder="e.g. Potassium Nitrate" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Brand/Manufacturer</span>
									<input type="text" bind:value={newItemBrand} placeholder="Optional" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Quantity <span class="text-red-500">*</span></span>
									<input type="number" step="any" bind:value={newItemQuantity} required placeholder="e.g. 50" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Unit <span class="text-red-500">*</span></span>
									<select bind:value={newItemUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
										<option value="Kg">Kg</option>
										<option value="Liters">Liters</option>
										<option value="Packets">Packets</option>
										<option value="Bags">Bags</option>
										<option value="Units">Units</option>
									</select>
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Cost per Unit</span>
									<input type="number" step="0.01" bind:value={newItemCostPerUnit} placeholder="Optional" class="input-field w-full text-xs" />
								</label>
								<label class="block col-span-2">
									<span class="block mb-1 text-[11px] text-slate-600">Notes</span>
									<input type="text" bind:value={newItemNotes} placeholder="Optional item notes" class="input-field w-full text-xs" />
								</label>
							</div>
						</div>
					{/if}

					{#if error}
						<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
							⚠️ {error}
						</div>
					{/if}

					<div class="flex gap-3 pt-3 border-t border-slate-100">
						<button 
							type="button" 
							onclick={() => showAddModal = false}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button 
							type="submit" 
							class="btn-primary flex-1 py-3 text-xs"
						>
							Log Expense
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Edit Expense Modal -->
	{#if showEditModal}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base font-headline-md">Edit Expense</h3>
					<button onclick={() => showEditModal = false} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<form onsubmit={handleEditExpense} class="mt-4 space-y-4 text-xs font-semibold text-slate-700 max-h-[80vh] overflow-y-auto pr-1">
					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Category</span>
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
							<span class="block mb-1">Status</span>
							<select bind:value={editStatus} class="input-field w-full text-xs bg-white py-[9.5px]">
								<option value="Pending">Pending</option>
								<option value="Completed">Completed</option>
							</select>
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="block mb-1">Amount (₹)</span>
							<input type="number" step="0.01" bind:value={editAmount} required placeholder="0.00" class="input-field w-full text-xs" />
						</label>
						<label class="block">
							<span class="block mb-1">Date</span>
							<input type="date" bind:value={editDate} required class="input-field w-full text-xs" />
						</label>
					</div>

					<label class="block">
						<span class="block mb-1">Description</span>
						<input type="text" bind:value={editDescription} required class="input-field w-full text-xs" />
					</label>

					<!-- Item Details Section (Conditional for Edit) -->
					{#if isConditionalCategory(editCategory)}
						<div transition:slide={{ duration: 200 }} class="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
							<h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
								<span class="material-symbols-outlined text-[16px] text-primary-green">inventory</span>
								Item Details ({editCategory})
							</h4>
							<div class="grid grid-cols-2 gap-3">
								<label class="block col-span-2">
									<span class="block mb-1 text-[11px] text-slate-600">Item Name <span class="text-red-500">*</span></span>
									<input type="text" bind:value={editItemName} required placeholder="e.g. Potassium Nitrate" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Brand/Manufacturer</span>
									<input type="text" bind:value={editItemBrand} placeholder="Optional" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Quantity <span class="text-red-500">*</span></span>
									<input type="number" step="any" bind:value={editItemQuantity} required placeholder="e.g. 50" class="input-field w-full text-xs" />
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Unit <span class="text-red-500">*</span></span>
									<select bind:value={editItemUnit} class="input-field w-full text-xs bg-white py-[9.5px]">
										<option value="Kg">Kg</option>
										<option value="Liters">Liters</option>
										<option value="Packets">Packets</option>
										<option value="Bags">Bags</option>
										<option value="Units">Units</option>
									</select>
								</label>
								<label class="block">
									<span class="block mb-1 text-[11px] text-slate-600">Cost per Unit</span>
									<input type="number" step="0.01" bind:value={editItemCostPerUnit} placeholder="Optional" class="input-field w-full text-xs" />
								</label>
								<label class="block col-span-2">
									<span class="block mb-1 text-[11px] text-slate-600">Notes</span>
									<input type="text" bind:value={editItemNotes} placeholder="Optional item notes" class="input-field w-full text-xs" />
								</label>
							</div>
						</div>
					{/if}

					{#if error}
						<div class="rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 animate-fade-in">
							⚠️ {error}
						</div>
					{/if}

					<div class="flex gap-3 pt-3 border-t border-slate-100">
						<button 
							type="button" 
							onclick={() => showEditModal = false}
							class="btn-secondary flex-1 py-3 text-xs"
						>
							Cancel
						</button>
						<button 
							type="submit" 
							class="btn-primary flex-1 py-3 text-xs"
						>
							Save Changes
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- View Details Modal -->
	{#if showViewModal && selectedExpense}
		<div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
			<div transition:slide={{ duration: 200 }} class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
				<div class="flex justify-between items-center pb-4 border-b border-slate-100">
					<h3 class="font-extrabold text-slate-800 text-base">Expense Details</h3>
					<button onclick={() => { showViewModal = false; selectedExpense = null; }} class="text-slate-400 hover:text-slate-600 transition-colors">
						<span class="material-symbols-outlined text-lg">close</span>
					</button>
				</div>
				<div class="mt-4 space-y-4 text-xs font-semibold text-slate-700">
					<div class="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
						<div>
							<span class="text-slate-400 block text-[10px] uppercase">Category</span>
							<span class="text-slate-800 font-extrabold text-sm">{selectedExpense.category}</span>
						</div>
						<div>
							<span class="text-slate-400 block text-[10px] uppercase">Date</span>
							<span class="text-slate-800 text-sm">{selectedExpense.date}</span>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
						<div>
							<span class="text-slate-400 block text-[10px] uppercase">Amount</span>
							<span class="text-slate-800 font-extrabold text-sm">₹{selectedExpense.amount.toLocaleString()}</span>
						</div>
						<div>
							<span class="text-slate-400 block text-[10px] uppercase">Status</span>
							<span class={['px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block mt-0.5', selectedExpense.statusColor].join(' ')}>
								{selectedExpense.status}
							</span>
						</div>
					</div>

					<div class="border-b border-slate-100 pb-3">
						<span class="text-slate-400 block text-[10px] uppercase">Description</span>
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
									<span class="text-slate-400 block">Item Name</span>
									<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.itemName}</span>
								</div>
								<div>
									<span class="text-slate-400 block">Brand</span>
									<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.brand || 'N/A'}</span>
								</div>
								<div>
									<span class="text-slate-400 block">Quantity</span>
									<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.quantity} {selectedExpense.itemDetails.unit}</span>
								</div>
								<div>
									<span class="text-slate-400 block">Cost per Unit</span>
									<span class="text-slate-800 font-bold">{selectedExpense.itemDetails.costPerUnit ? '₹' + selectedExpense.itemDetails.costPerUnit : 'N/A'}</span>
								</div>
								{#if selectedExpense.itemDetails.notes}
									<div class="col-span-2">
										<span class="text-slate-400 block">Item Notes</span>
										<span class="text-slate-800 font-normal block">{selectedExpense.itemDetails.notes}</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<div class="flex pt-2">
						<button 
							type="button" 
							onclick={() => { showViewModal = false; selectedExpense = null; }}
							class="btn-primary w-full py-3 text-xs"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

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
		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6">Date</th>
						<th class="p-4">Category</th>
						<th class="p-4">Description</th>
						<th class="p-4">Amount</th>
						<th class="p-4">Status</th>
						<th class="p-4 pr-6 text-center">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#if loading}
						{#each Array(2) as _}
							<tr class="animate-pulse border-b border-slate-50">
								<td class="p-4 pl-6"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-20 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-32 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
								<td class="p-4"><div class="skeleton h-4 w-16 rounded"></div></td>
								<td class="p-4 pr-6 text-center"><div class="skeleton h-4 w-14 rounded mx-auto"></div></td>
							</tr>
						{/each}
					{/if}
					{#each expenses as expense (expense.id)}
						<tr class="hover:bg-slate-50/30 transition-colors">
							<td class="p-4 pl-6 text-slate-400">{expense.date}</td>
							<td class="p-4 font-bold text-slate-800 flex items-center gap-1.5 mt-2 ml-4">
								{expense.category}
								{#if expense.itemDetails}
									<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary-green" title="Has Item Details"></span>
								{/if}
							</td>
							<td class="p-4 text-slate-500">{expense.description}</td>
							<td class="p-4 font-extrabold text-slate-800">₹{expense.amount.toFixed(2)}</td>
							<td class="p-4">
								<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', expense.statusColor].filter(Boolean).join(' ')}>
									{expense.status}
								</span>
							</td>
							<td class="p-4 pr-6 text-center">
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
