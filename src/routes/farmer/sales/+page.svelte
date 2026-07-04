<script>
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { showConfirm, showSuccess, showError } from '$lib/modal.svelte.js';
	import { preferences, formatCurrencyGlobal, getCurrencySymbolGlobal } from '$lib/preferences.svelte.js';

	const { data } = $props();

	let sales = $state([]);
	let inventory = $state([]);
	let harvests = $state([]);
	let crops = $state([]);
	let loading = $state(false);
	let error = $state('');

	$effect(() => {
		sales = data?.sales || [];
		inventory = data?.inventory || [];
		harvests = data?.harvests || [];
		crops = data?.crops || [];
	});

	// Helper to find harvest details or crop details for dynamic lifespan calculation
	function getLifespanDetails(itemName, itemHarvestIds = [], itemSourceId = '') {
		if (!itemName || typeof itemName !== 'string') {
			return null;
		}
		const cleanName = itemName.replace(/\s+Harvest$/i, '').trim().toLowerCase();
		
		let matchingHarvest = null;
		if (itemHarvestIds && itemHarvestIds.length > 0) {
			matchingHarvest = harvests.find(h => itemHarvestIds.includes(h.id));
		}
		if (!matchingHarvest && itemSourceId) {
			matchingHarvest = harvests.find(h => h.id === itemSourceId);
		}
		if (!matchingHarvest) {
			matchingHarvest = harvests.find(h => h.cropName.trim().toLowerCase() === cleanName);
		}

		if (matchingHarvest && matchingHarvest.lifespan && matchingHarvest.harvestDate) {
			return {
				lifespan: matchingHarvest.lifespan,
				harvestDate: matchingHarvest.harvestDate
			};
		}
		return null;
	}

	// Calculate remaining lifespan dynamically
	function calculateRemainingLifespan(item) {
		if (item && typeof item === 'object' && item.expiryDate) {
			const expiry = new Date(item.expiryDate + 'T00:00:00');
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const diffMs = expiry.getTime() - today.getTime();
			return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		}

		let lifespanStr = item.lifespan;
		let harvestDateStr = null;

		const details = getLifespanDetails(item.name, item.harvestIds, item.sourceId);
		if (details) {
			lifespanStr = details.lifespan;
			harvestDateStr = details.harvestDate;
		} else if (item.createdAt) {
			harvestDateStr = item.createdAt.split('T')[0];
		}

		if (!lifespanStr || !harvestDateStr) return null;

		const match = lifespanStr.match(/(\d+)/);
		if (!match) return null;

		const lifeDays = parseInt(match[1], 10);
		const harvested = new Date(harvestDateStr + 'T00:00:00');
		const expiryDate = new Date(harvested.getTime() + lifeDays * 24 * 60 * 60 * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const diffMs = expiryDate.getTime() - today.getTime();
		return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	}

	// ── Computed stats ──────────────────────────────────────────────
	let totalRevenue = $derived.by(() => sales.filter(x => !x.type || x.type === 'Sale').reduce((s, x) => s + (x.totalAmount || 0), 0));
	let totalSold = $derived.by(() => sales.filter(x => !x.type || x.type === 'Sale').reduce((s, x) => s + (x.quantity || 0), 0));
	let totalSelfUse = $derived.by(() => sales.filter(x => x.type === 'Self Use').reduce((s, x) => s + (x.quantity || 0), 0));
	let totalWastage = $derived.by(() => sales.filter(x => x.type === 'Wastage').reduce((s, x) => s + (x.quantity || 0), 0));

	// ── Modal state ──────────────────────────────────────────────────
	let showModal = $state(false);
	let selectedInventoryId = $state('');
	let selectedCategoryFilter = $state('');
	let allocationType = $state('Sale');
	let quantity = $state('');
	let pricePerUnit = $state('');
	let totalPrice = $state('');
	let buyerName = $state('');
	let notes = $state('');
	let saleDate = $state(new Date().toISOString().split('T')[0]);

	let activeCategories = $derived.by(() => {
		const cats = new Set(inventory.filter(i => (i.total || 0) - (i.soldUsed || 0) > 0.001).map(i => i.category).filter(Boolean));
		return Array.from(cats);
	});

	let dropdownOptions = $derived.by(() => {
		const filteredInv = inventory.filter(i => ((i.total || 0) - (i.soldUsed || 0) > 0.001) && (!selectedCategoryFilter || i.category === selectedCategoryFilter));
		
		const groups = {};
		for (const item of filteredInv) {
			const cleanName = item.name.replace(/\s+Harvest$/i, '').trim().toLowerCase();
			if (!groups[cleanName]) {
				groups[cleanName] = [];
			}
			groups[cleanName].push(item);
		}

		const result = [];
		for (const [cleanName, items] of Object.entries(groups)) {
			if (items.length > 1) {
				const totalAvail = items.reduce((sum, i) => sum + Math.max(0, (i.total || 0) - (i.soldUsed || 0)), 0);
				const first = items[0];
				
				result.push({
					isAggregate: true,
					id: `aggregate:${first.name}`,
					name: first.name,
					cleanName,
					unit: first.unit || 'Kg',
					category: first.category || '',
					price: first.price || '',
					displayName: `${first.name} — ${totalAvail} ${first.unit || 'Kg'}`,
					availableQty: totalAvail
				});
			}
			
			for (const item of items) {
				const daysLeft = calculateRemainingLifespan(item);
				const lifespanDisplay = daysLeft !== null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`) : '—';
				const avail = Math.max(0, (item.total || 0) - (item.soldUsed || 0));
				
				result.push({
					isAggregate: false,
					id: item.id,
					name: item.name,
					cleanName,
					unit: item.unit || 'Kg',
					category: item.category || '',
					price: item.price || '',
					displayName: `${item.name} — ${avail} ${item.unit || 'Kg'} (lifespan: ${lifespanDisplay})`,
					availableQty: avail
				});
			}
		}
		return result;
	});

	let selectedItem = $derived.by(() => dropdownOptions.find(opt => opt.id === selectedInventoryId) || null);
	let availableQty = $derived.by(() => selectedItem ? selectedItem.availableQty : 0);

	function handleQuantityInput(val) {
		quantity = val;
		const q = Number(quantity);
		if (q > 0) {
			if (pricePerUnit !== '' && pricePerUnit !== null && pricePerUnit !== undefined) {
				const p = Number(pricePerUnit);
				totalPrice = (Math.round(q * p * 100) / 100).toFixed(2);
			} else if (totalPrice !== '' && totalPrice !== null && totalPrice !== undefined) {
				const t = Number(totalPrice);
				pricePerUnit = (Math.round((t / q) * 100) / 100).toFixed(2);
			}
		}
	}

	function handlePriceInput(val) {
		pricePerUnit = val;
		if (pricePerUnit !== '' && pricePerUnit !== null && pricePerUnit !== undefined) {
			error = '';
		}
		const q = Number(quantity);
		if (q > 0 && pricePerUnit !== '' && pricePerUnit !== null && pricePerUnit !== undefined) {
			const p = Number(pricePerUnit);
			totalPrice = (Math.round(q * p * 100) / 100).toFixed(2);
		}
	}

	function handleTotalInput(val) {
		totalPrice = val;
		if (totalPrice !== '' && totalPrice !== null && totalPrice !== undefined) {
			error = '';
		}
		const q = Number(quantity);
		if (q > 0 && totalPrice !== '' && totalPrice !== null && totalPrice !== undefined) {
			const t = Number(totalPrice);
			pricePerUnit = (Math.round((t / q) * 100) / 100).toFixed(2);
		}
	}

	function handleInventoryChange() {
		const item = dropdownOptions.find(opt => opt.id === selectedInventoryId);
		if (item) {
			pricePerUnit = item.price || '';
			const q = Number(quantity);
			if (q > 0 && pricePerUnit !== '') {
				totalPrice = (Math.round(q * Number(pricePerUnit) * 100) / 100).toFixed(2);
			} else {
				totalPrice = '';
			}
		}
	}

	function openModal() {
		showModal = true;
		selectedInventoryId = '';
		selectedCategoryFilter = '';
		allocationType = 'Sale';
		quantity = '';
		pricePerUnit = '';
		totalPrice = '';
		buyerName = '';
		notes = '';
		saleDate = new Date().toISOString().split('T')[0];
		error = '';
	}

	function closeModal() {
		showModal = false;
		selectedCategoryFilter = '';
		allocationType = 'Sale';
		error = '';
	}

	async function handleAddSale(e) {
		e.preventDefault();
		if (!selectedItem) return;

		const qty = Number(quantity);
		if (isNaN(qty) || qty <= 0) {
			error = "Quantity must be a positive number.";
			return;
		}
		if (qty > availableQty) {
			error = `Quantity cannot exceed available stock of ${availableQty} ${selectedItem.unit || 'Kg'}`;
			return;
		}

		if (allocationType === 'Sale') {
			if ((pricePerUnit === '' || pricePerUnit === null || pricePerUnit === undefined) &&
				(totalPrice === '' || totalPrice === null || totalPrice === undefined)) {
				error = "At least one of Price per Unit or Total Price is required.";
				return;
			}
		}

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/sales', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					inventoryId: selectedItem.id,
					itemName: selectedItem.name,
					category: selectedItem.category || '',
					quantity: qty,
					unit: selectedItem.unit || 'Kg',
					pricePerUnit: allocationType === 'Sale' ? Number(pricePerUnit || 0) : 0,
					buyerName: allocationType === 'Sale' ? buyerName : '',
					notes,
					saleDate,
					type: allocationType
				})
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.error || 'Failed to add sale');

			await invalidateAll();
			closeModal();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDelete(sale) {
		const confirmed = await showConfirm({
			title: 'Delete Allocation?',
			message: `Delete allocation of ${sale.quantity} ${sale.unit} of "${sale.itemName}"? This will restore the stock.`,
			confirmText: 'Delete',
			confirmColor: 'bg-red-600 hover:bg-red-700 text-white'
		});
		if (!confirmed) return;

		loading = true;
		try {
			const res = await fetch(`/api/sales/${sale.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Failed to delete sale');
			}
			showSuccess('Sale allocation deleted successfully.');
			await invalidateAll();
		} catch (err) {
			showError(err.message);
		} finally {
			loading = false;
		}
	}

	// Bind page search parameter
	import { page } from '$app/state';
	let searchQuery = $derived(page.url.searchParams.get('search') || '');
	let activeFilter = $state('All');
	let dateFilter = $state('All');
	let customFromDate = $state('');
	let customToDate = $state('');
	let showMobileDateFilterDropdown = $state(false);
	let expandedSaleId = $state(null);

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
			case 'Half Year': {
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

	let filteredSales = $derived(
		sales.filter(s => {
			const q = searchQuery.trim().toLowerCase();
			const queryMatch = !q || (
				s.itemName?.toLowerCase().includes(q) ||
				s.buyerName?.toLowerCase().includes(q) ||
				s.notes?.toLowerCase().includes(q) ||
				(s.type || 'Sale').toLowerCase().includes(q)
			);
			
			const typeMatch = activeFilter === 'All' || 
				(activeFilter === 'Sales' && (!s.type || s.type === 'Sale')) ||
				(activeFilter === 'Self Use' && s.type === 'Self Use') ||
				(activeFilter === 'Wastage' && s.type === 'Wastage');

			const dateMatch = isDateInFilter(s.saleDate, dateFilter);

			return queryMatch && typeMatch && dateMatch;
		})
	);

	let currentPage = $state(1);
	const itemsPerPage = 10;

	$effect(() => {
		// Reset to page 1 whenever search query, active type filter, or date filter changes
		searchQuery;
		activeFilter;
		dateFilter;
		customFromDate;
		customToDate;
		currentPage = 1;
	});

	let totalPages = $derived(Math.max(1, Math.ceil(filteredSales.length / itemsPerPage)));
	let paginatedSales = $derived(filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

	$effect(() => {
		// Automatically adjust page to fit within totalPages after edit/delete
		if (currentPage > totalPages) {
			currentPage = totalPages;
		}
	});

	// ── Edit modal state and logic ────────────────────────────────────
	let showEditModal = $state(false);
	let editingSale = $state(null);
	let editBuyerName = $state('');
	let editPricePerUnit = $state('');
	let editTotalPrice = $state('');
	let editSaleDate = $state('');
	let editNotes = $state('');
	let editError = $state('');

	function openEditModal(sale) {
		editingSale = sale;
		editBuyerName = sale.buyerName || '';
		editPricePerUnit = sale.pricePerUnit !== undefined && sale.pricePerUnit !== null ? sale.pricePerUnit.toString() : '';
		editTotalPrice = sale.totalAmount !== undefined && sale.totalAmount !== null ? sale.totalAmount.toString() : '';
		editSaleDate = sale.saleDate ? sale.saleDate.split('T')[0] : '';
		editNotes = sale.notes || '';
		editError = '';
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingSale = null;
		editError = '';
	}

	function handleEditPriceInput(val) {
		editPricePerUnit = val;
		if (editPricePerUnit !== '' && editPricePerUnit !== null && editPricePerUnit !== undefined) {
			editError = '';
		}
		const q = Number(editingSale?.quantity || 0);
		if (q > 0 && editPricePerUnit !== '' && editPricePerUnit !== null && editPricePerUnit !== undefined) {
			const p = Number(editPricePerUnit);
			editTotalPrice = (Math.round(q * p * 100) / 100).toFixed(2);
		}
	}

	function handleEditTotalInput(val) {
		editTotalPrice = val;
		if (editTotalPrice !== '' && editTotalPrice !== null && editTotalPrice !== undefined) {
			editError = '';
		}
		const q = Number(editingSale?.quantity || 0);
		if (q > 0 && editTotalPrice !== '' && editTotalPrice !== null && editTotalPrice !== undefined) {
			const t = Number(editTotalPrice);
			editPricePerUnit = (Math.round((t / q) * 100) / 100).toFixed(2);
		}
	}

	async function handleUpdateSale(e) {
		e.preventDefault();
		if (!editingSale) return;

		if ((editPricePerUnit === '' || editPricePerUnit === null || editPricePerUnit === undefined) &&
			(editTotalPrice === '' || editTotalPrice === null || editTotalPrice === undefined)) {
			editError = "At least one of Price or Total is required.";
			return;
		}

		loading = true;
		editError = '';

		try {
			const res = await fetch(`/api/sales/${editingSale.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buyerName: editBuyerName,
					pricePerUnit: Number(editPricePerUnit || 0),
					totalAmount: Number(editTotalPrice || 0),
					saleDate: editSaleDate,
					notes: editNotes
				})
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.error || 'Failed to update sale');

			await invalidateAll();
			closeEditModal();
		} catch (err) {
			editError = err.message;
		} finally {
			loading = false;
		}
	}

	function formatDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
	}

	function formatCurrency(n) {
		return formatCurrencyGlobal(n, 2);
	}
</script>

<svelte:head>
	<title>Sales Log — AgriConnect</title>
</svelte:head>

<section class="max-w-screen-xl mx-auto space-y-6">

	<!-- Page header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div>
			<h1 class="font-extrabold text-2xl text-slate-800 tracking-tight">Sales Log</h1>
			<p class="text-slate-400 text-sm mt-0.5 font-medium">Track every sale and keep your inventory accurate automatically.</p>
		</div>
		<button
			onclick={openModal}
			class="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 rounded-xl"
		>
			<span class="material-symbols-outlined text-base">add</span>
			Record Sale
		</button>
	</div>

	<!-- Stats row -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		{#each [
			{ label: 'TOTAL REVENUE', value: formatCurrency(totalRevenue), icon: 'currency_rupee', bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]' },
			{ label: 'TOTAL SOLD (KG)', value: `${totalSold} kg`, icon: 'shopping_basket', bg: 'bg-[#e3f2fd]', text: 'text-[#1565c0]' },
			{ label: 'TOTAL SELF USE (KG)', value: `${totalSelfUse} kg`, icon: 'home', bg: 'bg-[#f3e5f5]', text: 'text-[#6a1b9a]' },
			{ label: 'TOTAL WASTAGE (KG)', value: `${totalWastage} kg`, icon: 'delete', bg: 'bg-[#fff8e1]', text: 'text-[#ff8f00]' }
		] as stat}
			<div class="rounded-3xl p-3 sm:p-6 flex items-center gap-3 sm:gap-5 border transition-all duration-300 {preferences.theme === 'dark' ? 'bg-[#161616] border-slate-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-850 shadow-sm'}">
				<div class="size-10 sm:size-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 {stat.bg} {stat.text}">
					<span class="material-symbols-outlined text-lg sm:text-[28px]">{stat.icon}</span>
				</div>
				<div class="min-w-0 flex flex-col justify-center">
					<p class="text-[8px] sm:text-[9.5px] font-extrabold uppercase tracking-widest text-slate-400 leading-none">{stat.label}</p>
					<p class="font-extrabold mt-1 sm:mt-2 text-xs sm:text-lg md:text-xl tracking-tight leading-snug {preferences.theme === 'dark' ? 'text-white' : 'text-slate-900'} whitespace-nowrap">{stat.value}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Mobile view (hidden on desktop md:block) -->
	<div class="block md:hidden p-4 rounded-3xl relative border shadow-2xl space-y-6 font-sans transition-colors duration-300 {preferences.theme === 'dark' ? 'bg-[#121212] border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-800'}">
		<!-- 1) Header Section -->
		<div class="flex items-center justify-between py-2 border-b gap-4 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/60'}">
			<div>
				<h2 class="text-sm font-black tracking-widest uppercase select-none {preferences.theme === 'dark' ? 'text-white' : 'text-slate-850'}">
					ALLOCATION LOG
				</h2>
				<p class="text-[10px] font-semibold mt-0.5 {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-455'}">
					Track inventory allocation and usage
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
					onclick={openModal}
					class="flex items-center justify-center rounded-xl size-9 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-white hover:bg-slate-800' : 'bg-white text-slate-700 hover:bg-slate-50'}"
					title="Record Allocation"
				>
					<span class="material-symbols-outlined text-[18px]">add</span>
				</button>

				{#if showMobileDateFilterDropdown}
					<!-- Date filter options floating menu -->
					<div class="absolute right-0 top-11 z-50 border rounded-xl shadow-2xl py-1.5 min-w-[150px] text-xs font-bold transition-colors duration-300 {preferences.theme === 'dark' ? 'bg-[#1e1e1e] border-slate-800 text-slate-355' : 'bg-white border-slate-200 text-slate-650'}">
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

		<!-- Tabs block -->
		<div class="flex flex-wrap gap-1.5">
			{#each ['All', 'Sales', 'Self Use', 'Wastage'] as filterName}
				<button
					type="button"
					onclick={() => activeFilter = filterName}
					class="px-3 py-1 text-[10px] font-extrabold rounded-full border transition-all cursor-pointer {activeFilter === filterName ? 'bg-primary-green text-white border-primary-green' : (preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-slate-400 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-505 border-slate-200 hover:bg-slate-100')}"
				>
					{filterName}
				</button>
			{/each}
		</div>

		<!-- 2) Search row -->
		<div class="flex items-center justify-between gap-3">
			<div class="relative flex-1">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[15px]">search</span>
				<input
					type="text"
					placeholder="Search item, buyer..."
					value={searchQuery}
					oninput={(e) => {
						const val = e.target.value;
						const url = new URL(window.location.href);
						if (val.trim()) {
							url.searchParams.set('search', val);
						} else {
							url.searchParams.delete('search');
						}
						import('$app/navigation').then(n => n.goto(url.toString(), { replaceState: true, keepFocus: true }));
					}}
					class="w-full rounded-full pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-green/30 transition-all shadow-sm focus:shadow-md {preferences.theme === 'dark' ? 'bg-[#1a1a1a] text-slate-300 placeholder-slate-600' : 'bg-white text-slate-700 placeholder-slate-400'}"
				/>
			</div>
			<div class="border px-3.5 py-1.5 rounded-full text-[10px] font-bold shrink-0 shadow-inner {preferences.theme === 'dark' ? 'bg-[#1a1a1a] text-slate-400 border-slate-850' : 'bg-slate-50 text-slate-650 border-slate-200'}">
				{filteredSales.length} {filteredSales.length === 1 ? 'log' : 'logs'}
			</div>
		</div>

		<!-- 3) Sales Card List -->
		<div class="space-y-3">
			{#each paginatedSales as sale (sale.id)}
				{@const matchingCrop = crops.find(c => c.name.toLowerCase() === sale.itemName.replace(/\s+Harvest$/i, '').trim().toLowerCase())}
				{@const imageUrl = matchingCrop?.imageUrl || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80'}
				
				<!-- Card wrapper -->
				<div 
					role="button"
					tabindex="0"
					onclick={() => expandedSaleId = (expandedSaleId === sale.id ? null : sale.id)}
					onkeydown={(e) => e.key === 'Enter' && (expandedSaleId = (expandedSaleId === sale.id ? null : sale.id))}
					class="border rounded-2xl p-3 flex flex-col gap-1 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 {preferences.theme === 'dark' ? 'bg-[#161616] border-slate-900/60 hover:border-slate-800' : 'bg-white border-slate-200/50 hover:border-slate-350'}"
				>
					<!-- Top Row: Thumbnail + Info (Name, Badges, Details) + Arrow -->
					<div class="flex items-center justify-between w-full gap-2.5">
						<!-- Left & middle content row -->
						<div class="flex items-center gap-3 flex-grow min-w-0">
							<!-- Crop Image -->
							<img 
								src={imageUrl} 
								alt={sale.itemName} 
								class="size-12 rounded-xl object-cover border shrink-0 {preferences.theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/50'}"
							/>
							
							<!-- Info block -->
							<div class="min-w-0 flex-grow">
								<!-- First Line: Name + Type Badge + Buyer -->
								<div class="flex items-center gap-1.5 flex-wrap">
									<h3 class="text-xs font-bold truncate max-w-[110px] leading-none {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">
										{sale.itemName}
									</h3>
									
									<!-- Type Badge -->
									{#if !sale.type || sale.type === 'Sale'}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#14231b] text-[#52c486] border border-[#1a3828]' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'}">
											Sale
										</span>
									{:else if sale.type === 'Self Use'}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#131f2b] text-[#4a9eff] border border-[#1b2b3a]' : 'bg-blue-50 text-blue-700 border border-blue-100/50'}">
											Self
										</span>
									{:else}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#281515] text-[#f87171] border-[#4c1d1d]' : 'bg-red-50 text-red-650 border border-red-100/50'}">
											Waste
										</span>
									{/if}

									<!-- Buyer Badge -->
									{#if (!sale.type || sale.type === 'Sale') && sale.buyerName}
										<span class="px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap {preferences.theme === 'dark' ? 'bg-[#1e1e1e] text-slate-350 border-[#2d2d2d]' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
											{sale.buyerName}
										</span>
									{/if}
								</div>
								
								<!-- Second Line: Details -->
								<p class="text-[9.5px] font-semibold mt-1 whitespace-nowrap {preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-455'}">
									{sale.quantity} {sale.unit}
									{#if !sale.type || sale.type === 'Sale'}
										• {formatCurrency(sale.totalAmount)}
									{/if}
									• {formatDate(sale.saleDate)}
								</p>
							</div>
						</div>

						<!-- Right Chevron (Dynamic Arrow) -->
						<span class="material-symbols-outlined text-base leading-none pl-1 shrink-0 {preferences.theme === 'dark' ? 'text-slate-550' : 'text-slate-400'}">
							{expandedSaleId === sale.id ? 'keyboard_arrow_down' : 'chevron_right'}
						</span>
					</div>

					<!-- Expanded Panel (Accordion Content) -->
					{#if expandedSaleId === sale.id}
						<div transition:slide={{ duration: 150 }} class="mt-3 pt-3 border-t space-y-3 text-[11px] font-semibold transition-colors duration-300 {preferences.theme === 'dark' ? 'border-slate-900/60 text-slate-350' : 'border-slate-205 text-slate-650'}">
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Allocation Type</span>
								<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{sale.type || 'Sale'}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Quantity</span>
								<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{sale.quantity} {sale.unit}</span>
							</div>
							{#if !sale.type || sale.type === 'Sale'}
								<div class="flex justify-between items-center">
									<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Price / Unit</span>
									<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{formatCurrency(sale.pricePerUnit)}</span>
								</div>
								<div class="flex justify-between items-center">
									<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Total Amount</span>
									<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{formatCurrency(sale.totalAmount)}</span>
								</div>
								<div class="flex justify-between items-center">
									<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Buyer</span>
									<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{sale.buyerName || '—'}</span>
								</div>
							{/if}
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Log Date</span>
								<span class="font-extrabold {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{formatDate(sale.saleDate)}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Category</span>
								<span class="font-extrabold capitalize {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{sale.category || '—'}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="{preferences.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}">Notes</span>
								<span class="font-extrabold truncate max-w-[200px] {preferences.theme === 'dark' ? 'text-white' : 'text-slate-800'}">{sale.notes || '—'}</span>
							</div>
							
							<div class="flex justify-end gap-4 pt-2 text-[11px] font-bold">
								{#if !sale.type || sale.type === 'Sale'}
									<button 
										type="button" 
										onclick={(e) => { e.stopPropagation(); openEditModal(sale); }} 
										class="flex items-center gap-1 transition-colors cursor-pointer {preferences.theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-850'}"
									>
										<span class="material-symbols-outlined text-[13px]">edit</span>
										<span>Edit</span>
									</button>
								{/if}
								<button 
									type="button" 
									onclick={(e) => { e.stopPropagation(); handleDelete(sale); }} 
									class="flex items-center gap-1 transition-colors cursor-pointer {preferences.theme === 'dark' ? 'text-red-500 hover:text-red-400' : 'text-red-650 hover:text-red-750'}"
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
					<span class="material-symbols-outlined text-3xl text-slate-600">point_of_sale</span>
					<p class="mt-2 text-xs font-semibold {preferences.theme === 'dark' ? 'text-slate-450' : 'text-slate-500'}">No allocations recorded yet</p>
				</div>
			{/each}
		</div>

		<!-- 4) Footer / Pagination -->
		<div class="flex items-center justify-between pt-4 border-t text-[10px] font-semibold {preferences.theme === 'dark' ? 'border-slate-900/60 text-slate-500' : 'border-slate-200/60 text-slate-450'}">
			<span>
				{#if filteredSales.length > 0}
					Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredSales.length)} of {filteredSales.length} records
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

	<!-- Sales table card -->
	<div class="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
		<!-- Toolbar -->
		<div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
			<div class="space-y-1.5">
				<h2 class="font-extrabold text-slate-800 text-sm">Inventory Allocation Log</h2>
				<div class="flex flex-wrap gap-1.5">
					{#each ['All', 'Sales', 'Self Use', 'Wastage'] as filterName}
						<button
							type="button"
							onclick={() => activeFilter = filterName}
							class="px-2.5 py-1 text-[10px] font-extrabold rounded-full border transition-all cursor-pointer {activeFilter === filterName ? 'bg-primary-green text-white border-primary-green' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}"
						>
							{filterName}
						</button>
					{/each}
				</div>
			</div>
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
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
					<option value="Half Year">Half Year</option>
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
						placeholder="Search item, buyer…"
						value={searchQuery}
						oninput={(e) => {
							const val = e.target.value;
							const url = new URL(window.location.href);
							if (val.trim()) {
								url.searchParams.set('search', val);
							} else {
								url.searchParams.delete('search');
							}
							import('$app/navigation').then(n => n.goto(url.toString(), { replaceState: true, keepFocus: true }));
						}}
						class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary-green bg-slate-50 focus:bg-white transition-colors"
					/>
				</div>
			</div>
		</div>

		<!-- Custom Date Range Pickers -->
		{#if dateFilter === 'Custom Date Range'}
			<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/30" transition:slide={{ duration: 150 }}>
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

		<!-- Table -->
		<div class="w-full">
			<table class="w-full text-left text-xs border-collapse table-fixed min-w-0">
				<thead>
					<tr class="bg-slate-50/50 font-bold uppercase tracking-wider text-[9px] text-slate-400 border-b border-slate-100">
						<th class="p-4 pl-6 w-[22%] sm:w-[10%]">Type</th>
						<th class="p-4 w-[48%] sm:w-[18%]">Item</th>
						<th class="p-4 hidden sm:table-cell sm:w-[12%]">Category</th>
						<th class="p-4 text-center hidden sm:table-cell sm:w-[8%]">Qty</th>
						<th class="p-4 text-center hidden sm:table-cell sm:w-[10%]">Price / Unit</th>
						<th class="p-4 text-right pr-6 w-[30%] sm:w-[12%]">Total</th>
						<th class="p-4 hidden sm:table-cell sm:w-[12%]">Buyer</th>
						<th class="p-4 text-center hidden sm:table-cell sm:w-[10%]">Date</th>
						<th class="p-4 pr-6 text-center hidden sm:table-cell sm:w-[8%]">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50 font-medium text-slate-600">
					{#each paginatedSales as sale (sale.id)}
						<tr class="hover:bg-slate-50/40 transition-colors" transition:fade={{ duration: 150 }}>
							<td class="p-4 pl-6 w-[22%] sm:w-auto">
								{#if !sale.type || sale.type === 'Sale'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-dark-green border border-emerald-250/50">
										Sale
									</span>
								{:else if sale.type === 'Self Use'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-250/50">
										Self
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-250/50">
										Waste
									</span>
								{/if}
							</td>
							<td class="p-4 w-[48%] sm:w-auto">
								<span class="font-bold text-slate-800 line-clamp-1">{sale.itemName}</span>
								<div class="sm:hidden text-[9px] text-slate-400 font-semibold space-y-0.5 mt-1">
									<p>Amount: {sale.quantity} {sale.unit} {#if (!sale.type || sale.type === 'Sale') && sale.pricePerUnit} @ {formatCurrency(sale.pricePerUnit)}{/if}</p>
									{#if (!sale.type || sale.type === 'Sale') && sale.buyerName}
										<p>Buyer: {sale.buyerName}</p>
									{/if}
									<p>Date: {formatDate(sale.saleDate)}</p>
								</div>
								{#if sale.notes}
									<span class="block text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5" title={sale.notes}>
										Note: {sale.notes}
									</span>
								{/if}
							</td>
							<td class="p-4 hidden sm:table-cell">
								<span class="text-slate-400 capitalize">{sale.category || '—'}</span>
							</td>
							<td class="p-4 text-center hidden sm:table-cell font-bold text-slate-700">{sale.quantity} {sale.unit}</td>
							<td class="p-4 text-center hidden sm:table-cell">
								{#if !sale.type || sale.type === 'Sale'}
									{formatCurrency(sale.pricePerUnit)}
								{:else}
									<span class="text-slate-350">—</span>
								{/if}
							</td>
							<td class="p-4 text-right pr-6 w-[30%] sm:w-auto">
								{#if !sale.type || sale.type === 'Sale'}
									<span class="font-extrabold text-dark-green">{formatCurrency(sale.totalAmount)}</span>
								{:else}
									<span class="text-slate-350 italic text-[10px] capitalize">{sale.type}</span>
								{/if}
							</td>
							<td class="p-4 truncate hidden sm:table-cell">
								{#if (!sale.type || sale.type === 'Sale') && sale.buyerName}
									{sale.buyerName}
								{:else}
									<span class="text-slate-350 italic">—</span>
								{/if}
							</td>
							<td class="p-4 text-center text-slate-500 hidden sm:table-cell">{formatDate(sale.saleDate)}</td>
							<td class="p-4 pr-6 text-center hidden sm:table-cell">
								<div class="flex items-center justify-center gap-1.5">
									{#if !sale.type || sale.type === 'Sale'}
										<button
											onclick={() => openEditModal(sale)}
											class="text-slate-300 hover:text-primary-green transition-colors p-1"
											title="Edit sale record"
										>
											<span class="material-symbols-outlined text-[16px]">edit</span>
										</button>
									{/if}
									<button
										onclick={() => handleDelete(sale)}
										class="text-slate-300 hover:text-red-500 transition-colors p-1"
										title="Delete log (restores stock)"
									>
										<span class="material-symbols-outlined text-[16px]">delete</span>
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="9" class="p-14 text-center">
								<div class="flex flex-col items-center gap-2">
									<span class="material-symbols-outlined text-4xl text-slate-200">point_of_sale</span>
									<p class="font-bold text-slate-400">No sales recorded yet.</p>
									<p class="text-slate-300 text-xs">Click "Record Sale" to log your first transaction.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-400 text-xs bg-slate-50/50">
			<span>
				{#if filteredSales.length > 0}
					Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSales.length)} of {filteredSales.length} allocations
				{:else}
					Showing 0 of 0 allocations
				{/if}
			</span>

			{#if totalPages > 1}
				<div class="flex items-center gap-1.5 font-bold">
					<button
						type="button"
						disabled={currentPage === 1}
						onclick={() => currentPage = Math.max(1, currentPage - 1)}
						class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
						class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
					>
						Next &gt;
					</button>
				</div>
			{/if}
		</div>
	</div>

</section>

<!-- Add Sale Modal -->
{#if showModal}
	<div
		role="button"
		tabindex="0"
		aria-label="Close modal"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 bg-slate-950/35 backdrop-blur-xs flex items-center justify-center z-50 p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { closeModal(); } }}
	>
		<div
			transition:slide={{ duration: 200 }}
			class="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
				<h3 class="font-extrabold text-slate-800 text-base">Record Inventory Allocation</h3>
				<button
					onclick={closeModal}
					class="text-slate-400 hover:text-slate-600 transition-colors size-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
				>
					<span class="material-symbols-outlined text-lg">close</span>
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleAddSale} class="p-6 space-y-4">
				{#if error}
					<div class="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5">
						{error}
					</div>
				{/if}

				<!-- Allocation Type select -->
				<div>
					<label for="allocationType" class="block text-xs font-bold text-slate-600 mb-1.5">Allocation Type <span class="text-red-400">*</span></label>
					<select
						id="allocationType"
						bind:value={allocationType}
						required
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					>
						<option value="Sale">🟢 Sale</option>
						<option value="Self Use">🔵 Self Use</option>
						<option value="Wastage">🟠 Wastage</option>
					</select>
				</div>

				<!-- Category Filter -->
				<div>
					<label for="categoryFilter" class="block text-xs font-bold text-slate-600 mb-1.5">Filter by Category</label>
					<select
						id="categoryFilter"
						bind:value={selectedCategoryFilter}
						onchange={() => { selectedInventoryId = ''; }}
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					>
						<option value="">All Categories</option>
						{#each activeCategories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<!-- Inventory item select -->
				<div>
					<label for="inventory" class="block text-xs font-bold text-slate-600 mb-1.5">Inventory Item <span class="text-red-400">*</span></label>
					<select
						id="inventory"
						bind:value={selectedInventoryId}
						onchange={handleInventoryChange}
						required
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
					>
						<option value="" disabled>Select inventory item…</option>
						{#each dropdownOptions as item}
							<option value={item.id}>
								{item.displayName}
							</option>
						{/each}
					</select>
					{#if selectedItem}
						<p class="text-[10px] text-slate-400 mt-1 font-semibold capitalize">
							Category: {selectedItem.category || '—'} &nbsp;|&nbsp; Available: <span class="text-dark-green font-extrabold">{availableQty} {selectedItem.unit || 'Kg'}</span>
						</p>
					{/if}
				</div>

				<div class="grid gap-3 {allocationType === 'Sale' ? 'grid-cols-2' : 'grid-cols-1'}">
					<!-- Quantity -->
					<div>
						<label for="quantity" class="block text-xs font-bold text-slate-600 mb-1.5">
							Quantity {selectedItem ? `(${selectedItem.unit || 'Kg'})` : ''} <span class="text-red-400">*</span>
						</label>
						<input
							id="quantity"
							type="number"
							min="0.001"
							max={availableQty || undefined}
							step="any"
							value={quantity}
							oninput={(e) => handleQuantityInput(e.target.value)}
							required
							placeholder="0"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
						/>
					</div>
					<!-- Price per unit -->
					{#if allocationType === 'Sale'}
						<div>
							<label for="price" class="block text-xs font-bold text-slate-600 mb-1.5">Price per {selectedItem?.unit || 'Unit'} ({getCurrencySymbolGlobal()})</label>
							<input
								id="price"
								type="number"
								min="0"
								step="any"
								value={pricePerUnit}
								oninput={(e) => handlePriceInput(e.target.value)}
								placeholder="0.00"
								class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
							/>
						</div>
					{/if}
				</div>

				<!-- Total Price -->
				{#if allocationType === 'Sale'}
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="totalPrice" class="block text-xs font-bold text-slate-600 mb-1.5">Total Price ({getCurrencySymbolGlobal()})</label>
							<input
								id="totalPrice"
								type="number"
								min="0"
								step="any"
								value={totalPrice}
								oninput={(e) => handleTotalInput(e.target.value)}
								placeholder="0.00"
								class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
							/>
						</div>
						<!-- Buyer name -->
						<div>
							<label for="buyer" class="block text-xs font-bold text-slate-600 mb-1.5">Buyer Name</label>
							<input
								id="buyer"
								type="text"
								bind:value={buyerName}
								placeholder="e.g. Ravi Traders"
								class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
							/>
						</div>
					</div>
				{/if}

				<!-- Sale date -->
				<div>
					<label for="sale-date" class="block text-xs font-bold text-slate-600 mb-1.5">Allocation Date <span class="text-red-400">*</span></label>
					<input
						id="sale-date"
						type="date"
						bind:value={saleDate}
						required
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green"
					/>
				</div>

				<!-- Notes -->
				<div>
					<label for="notes" class="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows="2"
						placeholder="Optional notes…"
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green resize-none"
					></textarea>
				</div>

				<!-- Actions -->
				<div class="flex gap-3 pt-2 border-t border-slate-100">
					<button
						type="button"
						onclick={closeModal}
						class="btn-secondary flex-1 py-3 text-xs"
					>Cancel</button>
					<button
						type="submit"
						disabled={loading || !selectedInventoryId}
						class="btn-primary flex-1 py-3 text-xs"
					>
						{loading ? 'Saving…' : 'Record Allocation'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Sale Modal -->
{#if showEditModal && editingSale}
	<div
		role="button"
		tabindex="0"
		aria-label="Close edit modal"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 bg-slate-950/35 backdrop-blur-xs flex items-center justify-center z-50 p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { closeEditModal(); } }}
	>
		<div
			transition:slide={{ duration: 200 }}
			class="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
				<h3 class="font-extrabold text-slate-800 text-base">Edit Sale Record</h3>
				<button
					onclick={closeEditModal}
					class="text-slate-400 hover:text-slate-600 transition-colors size-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
				>
					<span class="material-symbols-outlined text-lg">close</span>
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleUpdateSale} class="p-6 space-y-4">
				{#if editError}
					<div class="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5">
						{editError}
					</div>
				{/if}

				<div>
					<p class="text-xs text-slate-500 font-semibold mb-2">
						Editing allocation for: <span class="font-extrabold text-slate-800">{editingSale.itemName}</span>
					</p>
					<p class="text-[10px] text-slate-400 font-semibold uppercase">
						Quantity: {editingSale.quantity} {editingSale.unit} (Non-editable)
					</p>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<!-- Price per unit -->
					<div>
						<label for="editPrice" class="block text-xs font-bold text-slate-600 mb-1.5">Price per {editingSale.unit} ({getCurrencySymbolGlobal()})</label>
						<input
							id="editPrice"
							type="number"
							min="0"
							step="any"
							value={editPricePerUnit}
							oninput={(e) => handleEditPriceInput(e.target.value)}
							placeholder="0.00"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
						/>
					</div>
					<!-- Total Price -->
					<div>
						<label for="editTotalPrice" class="block text-xs font-bold text-slate-600 mb-1.5">Total Price ({getCurrencySymbolGlobal()})</label>
						<input
							id="editTotalPrice"
							type="number"
							min="0"
							step="any"
							value={editTotalPrice}
							oninput={(e) => handleEditTotalInput(e.target.value)}
							placeholder="0.00"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<!-- Buyer name -->
					<div>
						<label for="editBuyer" class="block text-xs font-bold text-slate-600 mb-1.5">Buyer Name</label>
						<input
							id="editBuyer"
							type="text"
							bind:value={editBuyerName}
							placeholder="e.g. Ravi Traders"
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
						/>
					</div>
					<!-- Sale date -->
					<div>
						<label for="editSaleDate" class="block text-xs font-bold text-slate-600 mb-1.5">Allocation Date <span class="text-red-400">*</span></label>
						<input
							id="editSaleDate"
							type="date"
							bind:value={editSaleDate}
							required
							class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green bg-white"
						/>
					</div>
				</div>

				<!-- Notes -->
				<div>
					<label for="editNotes" class="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
					<textarea
						id="editNotes"
						bind:value={editNotes}
						rows="2"
						placeholder="Optional notes…"
						class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-primary-green resize-none bg-white"
					></textarea>
				</div>

				<!-- Actions -->
				<div class="flex gap-3 pt-2 border-t border-slate-100">
					<button
						type="button"
						onclick={closeEditModal}
						class="btn-secondary flex-1 py-3 text-xs"
					>Cancel</button>
					<button
						type="submit"
						disabled={loading}
						class="btn-primary flex-1 py-3 text-xs"
					>
						{loading ? 'Saving…' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
