<script>
	import { onMount } from 'svelte';
	import ExportReportButton from '$lib/components/ExportReportButton.svelte';

	let { data } = $props();

	let crops = $derived(data.crops || []);
	let expenses = $derived(data.expenses || []);
	let inventory = $derived(data.inventory || []);
	let sales = $derived(data.sales || []);
	let weather = $derived(data.weather || { temp: 32, humidity: 45, windSpeed: 12, soilMoisture: 'Optimal' });

	// Filter state
	let rangeFilter = $state('Months');
	let xAxisFilter = $state('Weeks');
	let customXDays = $state(5);
	let customXMonths = $state(2);
	let chartLabelsCount = $state(0);
	let chartWidth = $derived(chartLabelsCount > 12 ? `${chartLabelsCount * 70}px` : '100%');

	let xAxisOptions = $derived.by(() => {
		if (rangeFilter === 'Months') {
			return [
				{ value: 'Weeks', label: 'Weeks' },
				{ value: 'Days', label: 'Days' },
				{ value: 'Custom Days', label: 'Custom no. of days' }
			];
		} else if (rangeFilter === 'Years') {
			return [
				{ value: 'Custom Months', label: 'Custom no. of months' },
				{ value: 'Quarters', label: 'Quarters' },
				{ value: 'Weeks', label: 'Weeks' },
				{ value: 'Days', label: 'Days' },
				{ value: 'Years', label: 'Years' }
			];
		} else if (rangeFilter === 'Days') {
			return [
				{ value: 'Days', label: 'Days' },
				{ value: 'Hours', label: 'Hours' }
			];
		} else if (rangeFilter === 'Weeks') {
			return [
				{ value: 'Weeks', label: 'Weeks' },
				{ value: 'Days', label: 'Days' }
			];
		} else if (rangeFilter === 'Quarters') {
			return [
				{ value: 'Quarters', label: 'Quarters' },
				{ value: 'Months', label: 'Months' },
				{ value: 'Weeks', label: 'Weeks' },
				{ value: 'Days', label: 'Days' }
			];
		} else if (rangeFilter === 'Half Years') {
			return [
				{ value: 'Half Years', label: 'Half Years' },
				{ value: 'Quarters', label: 'Quarters' },
				{ value: 'Months', label: 'Months' },
				{ value: 'Weeks', label: 'Weeks' },
				{ value: 'Days', label: 'Days' }
			];
		}
		return [];
	});

	// Reset xAxisFilter when rangeFilter changes
	$effect(() => {
		const options = xAxisOptions;
		if (options.length > 0) {
			const hasCurrent = options.some(opt => opt.value === xAxisFilter);
			if (!hasCurrent) {
				xAxisFilter = options[0].value;
			}
		}
	});

	function getWeekNumber(d) {
		const target = new Date(d.valueOf());
		const dayNr = (d.getDay() + 6) % 7;
		target.setDate(target.getDate() - dayNr + 3);
		const firstThursday = target.valueOf();
		target.setMonth(0, 1);
		if (target.getDay() !== 4) {
			target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
		}
		return 1 + Math.ceil((firstThursday - target) / 604800000);
	}

	// Periods list generator based on the selected range Filter type
	let periodsList = $derived.by(() => {
		const now = new Date();
		const list = [];
		if (rangeFilter === 'Days') {
			for (let i = 0; i < 30; i++) {
				const d = new Date(now);
				d.setDate(now.getDate() - i);
				const dateString = d.toISOString().split('T')[0];
				const label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
				const dStart = new Date(d);
				dStart.setHours(0, 0, 0, 0);
				const dEnd = new Date(d);
				dEnd.setHours(23, 59, 59, 999);
				list.push({ value: dateString, label, startDate: dStart, endDate: dEnd });
			}
		} else if (rangeFilter === 'Weeks') {
			for (let i = 0; i < 12; i++) {
				const d = new Date(now);
				d.setDate(now.getDate() - i * 7);
				const wNum = getWeekNumber(d);
				const yr = d.getFullYear();
				const day = d.getDay();
				const diff = d.getDate() - day + (day === 0 ? -6 : 1);
				const wStart = new Date(d);
				wStart.setDate(diff);
				wStart.setHours(0, 0, 0, 0);
				const wEnd = new Date(wStart);
				wEnd.setDate(wStart.getDate() + 6);
				wEnd.setHours(23, 59, 59, 999);
				const label = `Wk ${wNum}, ${yr} (${wStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${wEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
				list.push({ value: `${yr}-W${wNum}`, label, startDate: wStart, endDate: wEnd });
			}
		} else if (rangeFilter === 'Months') {
			for (let i = 0; i < 12; i++) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				const mNum = d.getMonth();
				const yr = d.getFullYear();
				const label = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
				const mStart = new Date(yr, mNum, 1);
				mStart.setHours(0, 0, 0, 0);
				const mEnd = new Date(yr, mNum + 1, 0, 23, 59, 59, 999);
				list.push({ value: `${yr}-M${mNum}`, label, startDate: mStart, endDate: mEnd });
			}
		} else if (rangeFilter === 'Quarters') {
			for (let i = 0; i < 8; i++) {
				const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
				const q = Math.floor(d.getMonth() / 3) + 1;
				const yr = d.getFullYear();
				const label = `Q${q} ${yr}`;
				const qStart = new Date(yr, (q - 1) * 3, 1);
				qStart.setHours(0, 0, 0, 0);
				const qEnd = new Date(yr, q * 3, 0, 23, 59, 59, 999);
				list.push({ value: `${yr}-Q${q}`, label, startDate: qStart, endDate: qEnd });
			}
		} else if (rangeFilter === 'Half Years') {
			for (let i = 0; i < 6; i++) {
				const d = new Date(now.getFullYear(), now.getMonth() - i * 6, 1);
				const h = Math.floor(d.getMonth() / 6) + 1;
				const yr = d.getFullYear();
				const label = `H${h} ${yr}`;
				const hStart = new Date(yr, (h - 1) * 6, 1);
				hStart.setHours(0, 0, 0, 0);
				const hEnd = new Date(yr, h * 6, 0, 23, 59, 59, 999);
				list.push({ value: `${yr}-H${h}`, label, startDate: hStart, endDate: hEnd });
			}
		} else if (rangeFilter === 'Years') {
			for (let i = 0; i < 5; i++) {
				const yr = now.getFullYear() - i;
				const label = `${yr}`;
				const yStart = new Date(yr, 0, 1);
				yStart.setHours(0, 0, 0, 0);
				const yEnd = new Date(yr, 11, 31, 23, 59, 59, 999);
				list.push({ value: `${yr}`, label, startDate: yStart, endDate: yEnd });
			}
		}
		return list;
	});

	let selectedPeriod = $state('');

	// Reset selectedPeriod when rangeFilter changes
	$effect(() => {
		const list = periodsList;
		if (list.length > 0) {
			const hasCurrent = list.some(p => p.value === selectedPeriod);
			if (!hasCurrent) {
				selectedPeriod = list[0].value;
			}
		}
	});

	let periodRange = $derived.by(() => {
		const currentPeriod = periodsList.find(p => p.value === selectedPeriod);
		if (currentPeriod) {
			return { start: currentPeriod.startDate, end: currentPeriod.endDate };
		}
		const start = new Date();
		start.setMonth(start.getMonth() - 1);
		return { start, end: new Date() };
	});

	let startDate = $derived(periodRange.start);
	let endDate = $derived(periodRange.end);

	function isWithinFilter(dateStr) {
		if (!dateStr) return false;
		const itemDate = new Date(dateStr);
		return itemDate >= startDate && itemDate <= endDate;
	}

	// Compute summaries dynamically
	let filteredExpenses = $derived(expenses.filter(e => isWithinFilter(e.rawDate || e.date || e.createdAt)));
	let filteredSales = $derived(sales.filter(s => isWithinFilter(s.saleDate || s.createdAt)));

	let totalExpenses = $derived(filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
	let totalRevenue = $derived(filteredSales.filter(x => !x.type || x.type === 'Sale').reduce((sum, item) => sum + Number(item.totalAmount || 0), 0));
	let totalStock = $derived(inventory.reduce((sum, item) => sum + Number(item.total || item.quantity || 0) - Number(item.soldUsed || 0), 0));
	let periodProfit = $derived(totalRevenue - totalExpenses);
	
	// Format currency
	function formatCurrency(val) {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0
		}).format(val);
	}

	let financialChartInstance;
	let cropChartInstance;
	let allocationChartInstance;
	let expenseBreakdownChartInstance;

	function getChartData() {
		const limit = new Date(endDate);
		const buckets = [];
		let current = new Date(startDate);

		while (current <= limit) {
			const bucketStart = new Date(current);
			const bucketEnd = new Date(current);
			let label = '';

			if (xAxisFilter === 'Hours') {
				bucketEnd.setHours(current.getHours() + 1);
				label = bucketStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
				current.setHours(current.getHours() + 1);
			} else if (xAxisFilter === 'Days') {
				bucketEnd.setDate(current.getDate() + 1);
				label = bucketStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
				current.setDate(current.getDate() + 1);
			} else if (xAxisFilter === 'Custom Days') {
				const days = Number(customXDays) || 1;
				bucketEnd.setDate(current.getDate() + days);
				label = `${bucketStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${new Date(Math.min(bucketEnd.getTime() - 1, limit.getTime())).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
				current.setDate(current.getDate() + days);
			} else if (xAxisFilter === 'Weeks') {
				bucketEnd.setDate(current.getDate() + 7);
				label = `Wk ${getWeekNumber(bucketStart)}`;
				current.setDate(current.getDate() + 7);
			} else if (xAxisFilter === 'Months') {
				bucketEnd.setMonth(current.getMonth() + 1);
				label = bucketStart.toLocaleDateString([], { month: 'short', year: '2-digit' });
				current.setMonth(current.getMonth() + 1);
			} else if (xAxisFilter === 'Custom Months') {
				const months = Number(customXMonths) || 1;
				bucketEnd.setMonth(current.getMonth() + months);
				label = `${bucketStart.toLocaleDateString([], { month: 'short', year: '2-digit' })} - ${new Date(Math.min(bucketEnd.getTime() - 1, limit.getTime())).toLocaleDateString([], { month: 'short', year: '2-digit' })}`;
				current.setMonth(current.getMonth() + months);
			} else if (xAxisFilter === 'Quarters') {
				bucketEnd.setMonth(current.getMonth() + 3);
				const q = Math.floor(bucketStart.getMonth() / 3) + 1;
				label = `Q${q} ${bucketStart.getFullYear()}`;
				current.setMonth(current.getMonth() + 3);
			} else if (xAxisFilter === 'Half Years') {
				bucketEnd.setMonth(current.getMonth() + 6);
				const h = Math.floor(bucketStart.getMonth() / 6) + 1;
				label = `H${h} ${bucketStart.getFullYear()}`;
				current.setMonth(current.getMonth() + 6);
			} else if (xAxisFilter === 'Years') {
				bucketEnd.setFullYear(current.getFullYear() + 1);
				label = `${bucketStart.getFullYear()}`;
				current.setFullYear(current.getFullYear() + 1);
			} else {
				bucketEnd.setDate(current.getDate() + 1);
				label = bucketStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
				current.setDate(current.getDate() + 1);
			}

			if (bucketStart > limit) break;

			buckets.push({
				start: bucketStart,
				end: bucketEnd,
				label,
				revenue: 0,
				expense: 0
			});
		}

		// Aggregate
		for (const bucket of buckets) {
			const bExpenses = expenses.filter(e => {
				const ed = new Date(e.rawDate || e.date || e.createdAt);
				return ed >= bucket.start && ed < bucket.end;
			});
			bucket.expense = bExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

			const bSales = sales.filter(s => {
				const sd = new Date(s.saleDate || s.createdAt);
				return (!s.type || s.type === 'Sale') && sd >= bucket.start && sd < bucket.end;
			});
			bucket.revenue = bSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
		}

		const labels = buckets.map(b => b.label);
		chartLabelsCount = labels.length;

		return {
			labels,
			revenueData: buckets.map(b => b.revenue),
			expenseData: buckets.map(b => b.expense)
		};
	}

	onMount(() => {
		const interval = setInterval(() => {
			if (typeof Chart !== 'undefined') {
				clearInterval(interval);
				initCharts();
			}
		}, 100);

		return () => {
			clearInterval(interval);
			financialChartInstance?.destroy();
			cropChartInstance?.destroy();
			allocationChartInstance?.destroy();
			expenseBreakdownChartInstance?.destroy();
		};
	});

	$effect(() => {
		const _deps = [rangeFilter, selectedPeriod, xAxisFilter, customXDays, customXMonths, data];
		if (typeof Chart !== 'undefined') {
			initCharts();
		}
	});

	function initCharts() {
		const ctxFin = document.getElementById('financialChart')?.getContext('2d');
		if (ctxFin) {
			financialChartInstance?.destroy();
			
			const { labels, revenueData, expenseData } = getChartData();

			financialChartInstance = new Chart(ctxFin, {
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{
							label: 'Revenue',
							data: revenueData,
							backgroundColor: '#10B981', // emerald-500
							borderRadius: 6,
							barPercentage: 0.8,
							categoryPercentage: 0.6
						},
						{
							label: 'Expense',
							data: expenseData,
							backgroundColor: '#3B82F6', // blue-500
							borderRadius: 6,
							barPercentage: 0.8,
							categoryPercentage: 0.6
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
							beginAtZero: true,
							grid: { color: 'rgba(226, 226, 226, 0.3)' }
						},
						x: {
							grid: { display: false }
						}
					}
				}
			});
		}

		// Crop Performance Doughnut Chart
		const ctxCrop = document.getElementById('cropChart')?.getContext('2d');
		if (ctxCrop) {
			cropChartInstance?.destroy();
			const cropNames = crops.map(c => c.name);
			const cropAcres = crops.map(c => c.acres || 10);
			
			cropChartInstance = new Chart(ctxCrop, {
				type: 'doughnut',
				data: {
					labels: cropNames.length > 0 ? cropNames : ['Wheat', 'Rice', 'Barley', 'Maize'],
					datasets: [{
						data: cropAcres.length > 0 ? cropAcres : [40, 30, 18, 12],
						backgroundColor: [
							'#15803D', // dark-green
							'#16A34A', // primary-green
							'#86EFAC', // secondary-green
							'#DCFCE7'  // light-green
						],
						borderWidth: 0,
						hoverOffset: 6
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '70%',
					plugins: {
						legend: {
							position: 'bottom',
							labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
						}
					}
				}
			});
		}

		// Stock Allocation (Sale vs Self Use vs Wastage) Doughnut Chart
		const ctxAlloc = document.getElementById('allocationChart')?.getContext('2d');
		if (ctxAlloc) {
			allocationChartInstance?.destroy();
			
			const saleQty = filteredSales.filter(x => !x.type || x.type === 'Sale').reduce((sum, item) => sum + Number(item.quantity || 0), 0);
			const selfUseQty = filteredSales.filter(x => x.type === 'Self Use').reduce((sum, item) => sum + Number(item.quantity || 0), 0);
			const wastageQty = filteredSales.filter(x => x.type === 'Wastage').reduce((sum, item) => sum + Number(item.quantity || 0), 0);
			const hasData = saleQty > 0 || selfUseQty > 0 || wastageQty > 0;

			allocationChartInstance = new Chart(ctxAlloc, {
				type: 'doughnut',
				data: {
					labels: ['Sale', 'Self Use', 'Wastage'],
					datasets: [{
						data: hasData ? [saleQty, selfUseQty, wastageQty] : [80, 15, 5],
						backgroundColor: [
							'#10B981', // emerald-500
							'#F59E0B', // amber-500
							'#EF4444'  // red-500
						],
						borderWidth: 0,
						hoverOffset: 6
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '70%',
					plugins: {
						legend: {
							position: 'bottom',
							labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
						}
					}
				}
			});
		}

		// Expense Category Breakdown Pie Chart
		const ctxExpBreakdown = document.getElementById('expenseBreakdownChart')?.getContext('2d');
		if (ctxExpBreakdown) {
			expenseBreakdownChartInstance?.destroy();
			
			const categories = ['Seed', 'Fertilizer', 'Chemicals', 'Labor', 'Water', 'Electricity', 'Others'];
			const categoryTotals = categories.map(cat => {
				if (cat === 'Others') {
					return filteredExpenses.filter(e => !categories.slice(0, -1).includes(e.category)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
				}
				return filteredExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.amount || 0), 0);
			});
			const hasData = categoryTotals.some(t => t > 0);

			expenseBreakdownChartInstance = new Chart(ctxExpBreakdown, {
				type: 'pie',
				data: {
					labels: categories,
					datasets: [{
						data: hasData ? categoryTotals : [12000, 24000, 8000, 35000, 15000, 10000, 5000],
						backgroundColor: [
							'#10B981', // emerald
							'#3B82F6', // blue
							'#EC4899', // pink
							'#F59E0B', // amber
							'#06B6D4', // cyan
							'#8B5CF6', // purple
							'#6B7280'  // gray
						],
						borderWidth: 0
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: { usePointStyle: true, padding: 12, font: { size: 10 } }
						}
					}
				}
			});
		}
	}
</script>

<svelte:head>
	<title>Farmer Dashboard - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	
	<!-- Header Banner -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
		<div>
			<h2 class="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h2>
			<p class="text-sm text-slate-500 mt-1">Good morning. Here is what is happening on the farm today.</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<!-- Range Filter -->
			<div class="relative min-w-[140px]">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-dark-green">calendar_month</span>
				<select
					bind:value={rangeFilter}
					class="w-full pl-9 pr-8 py-2 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-dark-green focus:outline-none focus:border-primary-green appearance-none cursor-pointer shadow-xs"
				>
					<option value="Days">Days Range</option>
					<option value="Weeks">Weeks Range</option>
					<option value="Months">Months Range</option>
					<option value="Quarters">Quarters Range</option>
					<option value="Half Years">Half Years Range</option>
					<option value="Years">Years Range</option>
				</select>
			</div>

			<!-- Specific Period Selector -->
			<div class="relative min-w-[160px]">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-dark-green">event</span>
				<select
					bind:value={selectedPeriod}
					class="w-full pl-9 pr-8 py-2 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-dark-green focus:outline-none focus:border-primary-green appearance-none cursor-pointer shadow-xs"
				>
					{#each periodsList as period}
						<option value={period.value}>{period.label}</option>
					{/each}
				</select>
			</div>

			<!-- X-Axis Filter -->
			<div class="relative min-w-[140px]">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-dark-green">bar_chart</span>
				<select
					bind:value={xAxisFilter}
					class="w-full pl-9 pr-8 py-2 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-dark-green focus:outline-none focus:border-primary-green appearance-none cursor-pointer shadow-xs"
				>
					{#each xAxisOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<!-- Custom inputs for grouping -->
			{#if xAxisFilter === 'Custom Days'}
				<div class="flex items-center gap-2 bg-white/60 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-xs">
					<span class="text-xs font-bold text-slate-500">Days:</span>
					<input
						type="number"
						bind:value={customXDays}
						min="1"
						class="w-12 text-xs font-bold focus:outline-none bg-transparent"
					/>
				</div>
			{/if}
			{#if xAxisFilter === 'Custom Months'}
				<div class="flex items-center gap-2 bg-white/60 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-xs">
					<span class="text-xs font-bold text-slate-500">Months:</span>
					<input
						type="number"
						bind:value={customXMonths}
						min="1"
						class="w-12 text-xs font-bold focus:outline-none bg-transparent"
					/>
				</div>
			{/if}
			<button class="bg-gradient-to-br from-primary-green to-dark-green text-white px-5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/30 cursor-pointer">
				<span class="material-symbols-outlined text-[18px]">download</span>
				<span>Export Report</span>
			</button>
		</div>
	</div>

	<!-- Bento Summary Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
		
		<!-- Active Crops -->
		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
			<div class="flex justify-between items-start">
				<div class="size-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-primary-green">
					<span class="material-symbols-outlined text-[22px]">psychology</span>
				</div>
				<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5">
					Active
				</span>
			</div>
			<div>
				<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Harvests</p>
				<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{crops.length} Crops</h3>
			</div>
		</div>

		<!-- Total Expenses -->
		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
			<div class="flex justify-between items-start">
				<div class="size-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
					<span class="material-symbols-outlined text-[22px]">payments</span>
				</div>
				<span class="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
					Tracked
				</span>
			</div>
			<div>
				<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
				<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{formatCurrency(totalExpenses)}</h3>
			</div>
		</div>

		<!-- Revenue -->
		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
			<div class="flex justify-between items-start">
				<div class="size-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
					<span class="material-symbols-outlined text-[22px]">trending_up</span>
				</div>
				<span class="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
					Stable
				</span>
			</div>
			<div>
				<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revenue</p>
				<h3 class="text-2xl font-extrabold text-slate-800 mt-1">{formatCurrency(totalRevenue)}</h3>
			</div>
		</div>

		<!-- Monthly Profit -->
		<div class="glass-card rounded-2xl p-6 flex flex-col justify-between h-36">
			<div class="flex justify-between items-start">
				<div class="size-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
					<span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
				</div>
				<span class="bg-emerald-100 text-dark-green px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5">
					<span class="material-symbols-outlined text-[12px]">arrow_upward</span> Stable
				</span>
			</div>
			<div>
				<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
					{rangeFilter === 'Months' ? 'Monthly Profit' : 'Period Profit'}
				</p>
				<h3 class="text-2xl font-extrabold {periodProfit < 0 ? 'text-red-600' : 'text-primary-green'} mt-1">
					{formatCurrency(periodProfit)}
				</h3>
			</div>
		</div>

	</div>

	<!-- Charts Grid (Asymmetric) -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		
		<!-- Financial Chart -->
		<div class="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col h-96">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Financial Overview</h3>
				<div class="flex gap-4 text-xs font-semibold text-slate-500">
					<span class="flex items-center"><span class="size-2.5 rounded-full bg-emerald-500 mr-1.5"></span> Revenue</span>
					<span class="flex items-center"><span class="size-2.5 rounded-full bg-blue-500 mr-1.5"></span> Expense</span>
				</div>
			</div>
			<div class="flex-grow relative overflow-x-auto w-full scrollbar-thin">
				<div class="h-full" style="width: {chartWidth}; min-width: 100%;">
					<canvas id="financialChart"></canvas>
				</div>
			</div>
		</div>

		<!-- Crop Doughnut Chart -->
		<div class="lg:col-span-1 glass-card rounded-2xl p-6 flex flex-col h-96">
			<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Crop Yield Share</h3>
			<div class="flex-grow relative">
				<canvas id="cropChart"></canvas>
			</div>
		</div>

	</div>

	<!-- Analysis Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		
		<!-- Stock Allocation (Sale vs Self Use vs Wastage) -->
		<div class="glass-card rounded-2xl p-6 flex flex-col h-96">
			<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Stock Allocation (Usage)</h3>
			<div class="flex-grow relative">
				<canvas id="allocationChart"></canvas>
			</div>
		</div>

		<!-- Expense Breakdown -->
		<div class="glass-card rounded-2xl p-6 flex flex-col h-96">
			<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Expense Category Breakdown</h3>
			<div class="flex-grow relative">
				<canvas id="expenseBreakdownChart"></canvas>
			</div>
		</div>

	</div>

	<!-- Activities Table & Weather Widget -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		
		<!-- Recent Activities -->
		<div class="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col overflow-hidden">
			<div class="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
				<h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Farm Logs</h3>
				<button class="text-primary-green font-bold text-xs hover:underline">View All</button>
			</div>
			
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
							<th class="py-2.5">Activity</th>
							<th class="py-2.5">Category</th>
							<th class="py-2.5">Detail</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50 text-slate-600 font-medium">
						{#each crops.slice(0, 3) as crop}
							<tr class="hover:bg-slate-50/50 transition-colors">
								<td class="py-3.5">
									<div class="flex items-center gap-3">
										<div class="size-8 rounded-full bg-emerald-50 text-primary-green flex items-center justify-center">
											<span class="material-symbols-outlined text-[16px]">agriculture</span>
										</div>
										<div>
											<p class="font-bold text-slate-800">{crop.name}</p>
											<p class="text-[10px] text-slate-400">{crop.location}</p>
										</div>
									</div>
								</td>
								<td class="py-3.5 text-slate-400">Crop Cycle</td>
								<td class="py-3.5"><span class="px-2 py-0.5 rounded-full bg-emerald-50 text-dark-green text-[10px] font-bold border border-emerald-100">{crop.harvestDuration || 'Seasonal'}</span></td>
							</tr>
						{:else}
							<tr class="hover:bg-slate-50/50 transition-colors">
								<td class="py-3.5 text-slate-400 text-center" colspan="3">No crop activities logged yet.</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Weather Micro Widget -->
		<div class="lg:col-span-1 rounded-2xl overflow-hidden relative flex flex-col justify-between min-h-[300px] text-white p-4 shadow-sm border border-slate-200/50 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=500&q=80');">
			<!-- Glassmorphic panel overlaying current conditions -->
			<div class="relative z-10 w-full h-full p-5 rounded-xl bg-slate-900/30 backdrop-blur-md border border-white/20 flex flex-col justify-between">
				<div class="flex justify-between items-start">
					<div>
						<h3 class="font-extrabold text-base text-white">Farm Conditions</h3>
						<p class="text-[10px] text-white/80 mt-0.5">Central Valley Fields</p>
					</div>
					<span class="material-symbols-outlined text-yellow-300 text-[28px] filled">light_mode</span>
				</div>

				<div>
					<p class="text-5xl font-light tracking-tight leading-none text-white">{weather.temp}°<span class="text-base font-medium text-white/80">C</span></p>
					<p class="text-xs font-semibold text-white/80 mt-1">Partly Cloudy • Humid</p>
				</div>

				<div class="space-y-2 pt-2 border-t border-white/10">
					<div class="flex justify-between items-center text-[11px] font-semibold text-white/90">
						<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">humidity_mid</span> Humidity</span>
						<span>{weather.humidity}%</span>
					</div>
					<div class="w-full bg-white/25 rounded-full h-1">
						<div class="bg-yellow-300 h-1 rounded-full" style="width: {weather.humidity}%"></div>
					</div>
					<div class="flex justify-between items-center text-[11px] font-semibold text-white/95 pt-0.5">
						<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">air</span> Wind</span>
						<span>{weather.windSpeed} km/h</span>
					</div>
					<div class="flex justify-between items-center text-[11px] font-semibold text-white/95 pt-0.5">
						<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">water_drop</span> Soil Moisture</span>
						<span class="text-yellow-300">{weather.soilMoisture}</span>
					</div>
				</div>
			</div>
		</div>

	</div>

</section>

<style>
	/* Custom scrollbar styling for the chart overflow container */
	.scrollbar-thin::-webkit-scrollbar {
		height: 6px;
	}
	.scrollbar-thin::-webkit-scrollbar-track {
		background: rgba(241, 245, 249, 0.5);
		border-radius: 8px;
	}
	.scrollbar-thin::-webkit-scrollbar-thumb {
		background: rgba(16, 185, 129, 0.3);
		border-radius: 8px;
	}
	.scrollbar-thin::-webkit-scrollbar-thumb:hover {
		background: rgba(16, 185, 129, 0.5);
	}
</style>
