<script>
	import { fade, slide } from 'svelte/transition';
	import { generateReportPdf } from '$lib/pdf/reportGenerator';
	import { authState } from '$lib/auth.svelte.js';

	let { 
		reportType = 'crops', 
		dataList = [], 
		// If multiple report types are supported from the same button, pass them here
		reportOptions = [], 
		// For dashboard/analytics summary, we pass other datasets as well
		extraData = null, 
		class: customClass = '' 
	} = $props();

	let showModal = $state(false);
	let selectedReportType = $state('');
	let datePreset = $state('all'); // 'all', '7days', '30days', 'month', 'quarter', 'year', 'custom'
	let startDate = $state('');
	let endDate = $state('');
	
	// Set default dates for custom picker
	$effect(() => {
		if (showModal && !startDate && !endDate) {
			const today = new Date();
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(today.getDate() - 30);
			startDate = thirtyDaysAgo.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		}
	});

	// Reset when reportType prop changes
	$effect(() => {
		selectedReportType = reportType;
	});

	function getRecordDate(item) {
		if (!item) return null;
		// Standardize date extraction
		const raw = item.date || item.plantedDate || item.harvestDate || item.detectedAt || item.createdAt || item.saleDate || item.rawDate;
		if (!raw) return null;
		return new Date(raw);
	}

	function filterDataByDate(list, start, end) {
		if (datePreset === 'all') return list;
		
		const limitStart = new Date(start);
		limitStart.setHours(0, 0, 0, 0);
		const limitEnd = new Date(end);
		limitEnd.setHours(23, 59, 59, 999);

		return list.filter(item => {
			const itemDate = getRecordDate(item);
			if (!itemDate) return true; // Keep items with no dates if we filter
			return itemDate >= limitStart && itemDate <= limitEnd;
		});
	}

	function getDateRangeString(start, end) {
		if (datePreset === 'all') return 'All Time';
		const options = { day: 'numeric', month: 'short', year: 'numeric' };
		const startF = new Date(start).toLocaleDateString('en-IN', options);
		const endF = new Date(end).toLocaleDateString('en-IN', options);
		return `${startF} - ${endF}`;
	}

	function handlePresetChange() {
		const today = new Date();
		if (datePreset === 'all') {
			startDate = '';
			endDate = '';
		} else if (datePreset === '7days') {
			const d = new Date();
			d.setDate(today.getDate() - 7);
			startDate = d.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		} else if (datePreset === '30days') {
			const d = new Date();
			d.setDate(today.getDate() - 30);
			startDate = d.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		} else if (datePreset === 'month') {
			const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
			startDate = startOfMonth.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		} else if (datePreset === 'quarter') {
			const currentQuarterMonth = Math.floor(today.getMonth() / 3) * 3;
			const startOfQuarter = new Date(today.getFullYear(), currentQuarterMonth, 1);
			startDate = startOfQuarter.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		} else if (datePreset === 'year') {
			const startOfYear = new Date(today.getFullYear(), 0, 1);
			startDate = startOfYear.toISOString().split('T')[0];
			endDate = today.toISOString().split('T')[0];
		}
	}

	async function handleExport() {
		let currentStart = startDate;
		let currentEnd = endDate;

		if (datePreset !== 'all' && (!currentStart || !currentEnd)) {
			alert('Please select valid start and end dates.');
			return;
		}

		const dateRangeStr = getDateRangeString(currentStart, currentEnd);
		const userName = authState.profile?.fullName || authState.user?.email || 'Authorized Member';

		// Generate summary statistics for dashboard/analytics report
		let summaryStats = {};
		if (selectedReportType === 'dashboard_summary' || selectedReportType === 'analytics') {
			const crops = extraData?.crops || dataList || [];
			const expenses = extraData?.expenses || [];
			const inventory = extraData?.inventory || [];
			const sales = extraData?.sales || [];
			const disease = extraData?.disease || [];
			const harvests = extraData?.harvests || [];

			const filteredCrops = filterDataByDate(crops, currentStart, currentEnd);
			const filteredExpenses = filterDataByDate(expenses, currentStart, currentEnd);
			const filteredInventory = filterDataByDate(inventory, currentStart, currentEnd);
			const filteredSales = filterDataByDate(sales, currentStart, currentEnd);
			const filteredDisease = filterDataByDate(disease, currentStart, currentEnd);
			const filteredHarvests = filterDataByDate(harvests, currentStart, currentEnd);

			const revenue = filteredSales.filter(x => !x.type || x.type === 'Sale').reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
			const expenseSum = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
			const invValue = filteredInventory.reduce((sum, item) => {
				const qty = Number(item.quantity || item.total || 0) - Number(item.soldUsed || 0);
				const price = Number(item.pricePerUnit || item.price || 0);
				return sum + (qty * price);
			}, 0);

			summaryStats = {
				revenue,
				expenses: expenseSum,
				cropsCount: filteredCrops.length,
				harvestsCount: filteredHarvests.length,
				inventoryCount: filteredInventory.length,
				inventoryValue: invValue,
				diseaseCount: filteredDisease.length,
				totalAcres: filteredCrops.reduce((sum, c) => sum + Number(c.acres || 0), 0)
			};
		}

		// Filter the primary list
		let finalDataList = [];
		if (selectedReportType === 'dashboard_summary' || selectedReportType === 'analytics') {
			// For dashboard/analytics summary, data is structured or empty as we draw from summaryStats
			finalDataList = [1]; 
		} else {
			finalDataList = filterDataByDate(dataList, currentStart, currentEnd);
		}

		await generateReportPdf(selectedReportType, finalDataList, {
			userName,
			dateRangeStr,
			summaryStats
		});

		showModal = false;
	}
</script>

<!-- Export Button -->
<button 
	onclick={() => showModal = true} 
	class={customClass || "btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer"}
>
	<span class="material-symbols-outlined text-base">picture_as_pdf</span>
	<span>Export PDF</span>
</button>

<!-- Date Filtering Modal -->
{#if showModal}
	<div 
		transition:fade={{ duration: 200 }} 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
	>
		<div 
			transition:slide={{ duration: 250 }} 
			class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100"
		>
			<!-- Modal Header -->
			<div class="bg-primary-green p-5 text-white flex justify-between items-center">
				<div class="flex items-center gap-2">
					<span class="material-symbols-outlined text-2xl">picture_as_pdf</span>
					<h3 class="text-lg font-bold tracking-tight">Configure PDF Export</h3>
				</div>
				<button 
					onclick={() => showModal = false} 
					class="text-white/80 hover:text-white transition-colors cursor-pointer"
				>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>

			<!-- Modal Body -->
			<div class="p-6 space-y-5">
				<!-- Option: Report Type selection (only if multiple are provided) -->
				{#if reportOptions && reportOptions.length > 0}
					<div class="space-y-1.5">
						<label for="report-select" class="text-xs font-bold text-slate-500 uppercase tracking-wider">Report Category</label>
						<select 
							id="report-select"
							bind:value={selectedReportType} 
							class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:border-primary-green transition-all"
						>
							{#each reportOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Date Preset Select -->
				<div class="space-y-1.5">
					<label for="preset-select" class="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Date Range</label>
					<select 
						id="preset-select"
						bind:value={datePreset} 
						onchange={handlePresetChange}
						class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:border-primary-green transition-all"
					>
						<option value="all">All Time</option>
						<option value="7days">Last 7 Days</option>
						<option value="30days">Last 30 Days</option>
						<option value="month">This Month</option>
						<option value="quarter">This Quarter</option>
						<option value="year">This Year</option>
						<option value="custom">Custom Range</option>
					</select>
				</div>

				<!-- Custom Date Range Inputs -->
				{#if datePreset === 'custom'}
					<div transition:slide={{ duration: 150 }} class="grid grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label for="start-date" class="text-xs font-semibold text-slate-500">Start Date</label>
							<input 
								id="start-date"
								type="date" 
								bind:value={startDate} 
								class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-primary-green transition-all"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="end-date" class="text-xs font-semibold text-slate-500">End Date</label>
							<input 
								id="end-date"
								type="date" 
								bind:value={endDate} 
								class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-primary-green transition-all"
							/>
						</div>
					</div>
				{/if}

				<!-- Disclaimer / PDF Note -->
				<div class="flex items-start gap-2.5 p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
					<span class="material-symbols-outlined text-primary-green text-lg mt-0.5">info</span>
					<p class="text-[11px] leading-normal text-emerald-800">
						Reports are generated immediately as printable A4 Portrait PDF documents, customized with AgriConnect branding, headers, page numbers, and summarized cards.
					</p>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
				<button 
					onclick={() => showModal = false} 
					class="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
				>
					Cancel
				</button>
				<button 
					onclick={handleExport} 
					class="btn-primary px-5 py-2 text-xs font-bold shadow-sm cursor-pointer"
				>
					Generate Report
				</button>
			</div>
		</div>
	</div>
{/if}
