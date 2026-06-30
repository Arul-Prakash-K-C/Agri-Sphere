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
	let activeFilter = $state('This Month');
	let customType = $state('days'); // 'days', 'months', 'years'
	let customValue = $state(30);

	function isWithinFilter(dateStr) {
		if (!dateStr) return false;
		const itemDate = new Date(dateStr);
		const now = new Date();
		
		if (activeFilter === 'This Week') {
			const startOfWeek = new Date(now);
			const day = startOfWeek.getDay();
			const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
			startOfWeek.setDate(diff);
			startOfWeek.setHours(0,0,0,0);
			return itemDate >= startOfWeek && itemDate <= now;
		} else if (activeFilter === 'This Month') {
			return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
		} else if (activeFilter === 'This Quarter') {
			const currentQuarter = Math.floor(now.getMonth() / 3);
			const itemQuarter = Math.floor(itemDate.getMonth() / 3);
			return currentQuarter === itemQuarter && itemDate.getFullYear() === now.getFullYear();
		} else if (activeFilter === 'Half Yearly') {
			const halfYearAgo = new Date(now);
			halfYearAgo.setMonth(now.getMonth() - 6);
			halfYearAgo.setHours(0,0,0,0);
			return itemDate >= halfYearAgo && itemDate <= now;
		} else if (activeFilter === 'This Year') {
			return itemDate.getFullYear() === now.getFullYear();
		} else if (activeFilter === 'Custom Range') {
			const customAgo = new Date(now);
			if (customType === 'days') {
				customAgo.setDate(now.getDate() - customValue);
			} else if (customType === 'months') {
				customAgo.setMonth(now.getMonth() - customValue);
			} else if (customType === 'years') {
				customAgo.setFullYear(now.getFullYear() - customValue);
			}
			customAgo.setHours(0,0,0,0);
			return itemDate >= customAgo && itemDate <= now;
		}
		return true;
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

	function getChartData() {
		const now = new Date();
		let labels = [];
		let expenseData = [];
		let profitData = [];

		if (activeFilter === 'This Week') {
			labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
			expenseData = [0, 0, 0, 0, 0, 0, 0];
			profitData = [0, 0, 0, 0, 0, 0, 0];

			const startOfWeek = new Date(now);
			const day = startOfWeek.getDay();
			const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
			startOfWeek.setDate(diff);
			startOfWeek.setHours(0,0,0,0);

			for (let i = 0; i < 7; i++) {
				const currentDay = new Date(startOfWeek);
				currentDay.setDate(startOfWeek.getDate() + i);
				
				const dayExp = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getDate() === currentDay.getDate() && ed.getMonth() === currentDay.getMonth() && ed.getFullYear() === currentDay.getFullYear();
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);

				const daySales = sales
					.filter(s => {
						const sd = new Date(s.saleDate || s.createdAt);
						return (!s.type || s.type === 'Sale') && sd.getDate() === currentDay.getDate() && sd.getMonth() === currentDay.getMonth() && sd.getFullYear() === currentDay.getFullYear();
					})
					.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

				expenseData[i] = dayExp;
				profitData[i] = Math.max(0, daySales - dayExp);
			}
		} else if (activeFilter === 'This Month') {
			labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
			expenseData = [0, 0, 0, 0, 0];
			profitData = [0, 0, 0, 0, 0];

			for (let i = 0; i < 5; i++) {
				const startDay = i * 7 + 1;
				const endDay = Math.min((i + 1) * 7, 31);

				const weekExp = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getMonth() === now.getMonth() && ed.getFullYear() === now.getFullYear() && ed.getDate() >= startDay && ed.getDate() <= endDay;
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);

				const weekSales = sales
					.filter(s => {
						const sd = new Date(s.saleDate || s.createdAt);
						return (!s.type || s.type === 'Sale') && sd.getMonth() === now.getMonth() && sd.getFullYear() === now.getFullYear() && sd.getDate() >= startDay && sd.getDate() <= endDay;
					})
					.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

				expenseData[i] = weekExp;
				profitData[i] = Math.max(0, weekSales - weekExp);
			}
		} else if (activeFilter === 'This Quarter') {
			const currentQuarter = Math.floor(now.getMonth() / 3);
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			
			for (let i = 0; i < 3; i++) {
				const targetMonth = currentQuarter * 3 + i;
				labels.push(monthNames[targetMonth]);

				const monthExp = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getMonth() === targetMonth && ed.getFullYear() === now.getFullYear();
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);

				const monthSales = sales
					.filter(s => {
						const sd = new Date(s.saleDate || s.createdAt);
						return (!s.type || s.type === 'Sale') && sd.getMonth() === targetMonth && sd.getFullYear() === now.getFullYear();
					})
					.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

				expenseData.push(monthExp);
				profitData.push(Math.max(0, monthSales - monthExp));
			}
		} else if (activeFilter === 'Half Yearly') {
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			for (let i = 5; i >= 0; i--) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				labels.push(monthNames[d.getMonth()]);

				const mExp = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);

				const mSales = sales
					.filter(s => {
						const sd = new Date(s.saleDate || s.createdAt);
						return (!s.type || s.type === 'Sale') && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
					})
					.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

				expenseData.push(mExp);
				profitData.push(Math.max(0, mSales - mExp));
			}
		} else if (activeFilter === 'This Year') {
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			for (let i = 0; i < 12; i++) {
				labels.push(monthNames[i]);

				const mExp = expenses
					.filter(e => {
						const ed = new Date(e.rawDate || e.date || e.createdAt);
						return ed.getMonth() === i && ed.getFullYear() === now.getFullYear();
					})
					.reduce((acc, e) => acc + Number(e.amount || 0), 0);

				const mSales = sales
					.filter(s => {
						const sd = new Date(s.saleDate || s.createdAt);
						return (!s.type || s.type === 'Sale') && sd.getMonth() === i && sd.getFullYear() === now.getFullYear();
					})
					.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

				expenseData.push(mExp);
				profitData.push(Math.max(0, mSales - mExp));
			}
		} else if (activeFilter === 'Custom Range') {
			if (customType === 'days') {
				for (let i = customValue - 1; i >= 0; i--) {
					const d = new Date();
					d.setDate(now.getDate() - i);
					labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

					const dayExp = expenses
						.filter(e => {
							const ed = new Date(e.rawDate || e.date || e.createdAt);
							return ed.getDate() === d.getDate() && ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
						})
						.reduce((acc, e) => acc + Number(e.amount || 0), 0);

					const daySales = sales
						.filter(s => {
							const sd = new Date(s.saleDate || s.createdAt);
							return (!s.type || s.type === 'Sale') && sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
						})
						.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

					expenseData.push(dayExp);
					profitData.push(Math.max(0, daySales - dayExp));
				}
			} else if (customType === 'months') {
				const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
				for (let i = customValue - 1; i >= 0; i--) {
					const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
					labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);

					const mExp = expenses
						.filter(e => {
							const ed = new Date(e.rawDate || e.date || e.createdAt);
							return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
						})
						.reduce((acc, e) => acc + Number(e.amount || 0), 0);

					const mSales = sales
						.filter(s => {
							const sd = new Date(s.saleDate || s.createdAt);
							return (!s.type || s.type === 'Sale') && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
						})
						.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

					expenseData.push(mExp);
					profitData.push(Math.max(0, mSales - mExp));
				}
			} else if (customType === 'years') {
				for (let i = customValue - 1; i >= 0; i--) {
					const targetYear = now.getFullYear() - i;
					labels.push(String(targetYear));

					const yExp = expenses
						.filter(e => {
							const ed = new Date(e.rawDate || e.date || e.createdAt);
							return ed.getFullYear() === targetYear;
						})
						.reduce((acc, e) => acc + Number(e.amount || 0), 0);

					const ySales = sales
						.filter(s => {
							const sd = new Date(s.saleDate || s.createdAt);
							return (!s.type || s.type === 'Sale') && sd.getFullYear() === targetYear;
						})
						.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

					expenseData.push(yExp);
					profitData.push(Math.max(0, ySales - yExp));
				}
			}
		}

		return { labels, expenseData, profitData };
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
		};
	});

	$effect(() => {
		const _deps = [activeFilter, customType, customValue, data];
		if (typeof Chart !== 'undefined') {
			initCharts();
		}
	});

	function initCharts() {
		const ctxFin = document.getElementById('financialChart')?.getContext('2d');
		if (ctxFin) {
			financialChartInstance?.destroy();
			
			const { labels, expenseData, profitData } = getChartData();

			financialChartInstance = new Chart(ctxFin, {
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{
							type: 'line',
							label: 'Expense',
							data: expenseData,
							borderColor: '#ba1a1a', // error
							borderWidth: 2.5,
							tension: 0.4,
							pointBackgroundColor: '#ffffff',
							pointBorderColor: '#ba1a1a',
							pointRadius: 4,
							fill: false
						},
						{
							type: 'bar',
							label: 'Profit',
							data: profitData,
							backgroundColor: '#16A34A', // primary-green
							borderRadius: 8,
							barPercentage: 0.55
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
			{#if activeFilter === 'Custom Range'}
				<div class="flex items-center gap-2 bg-white/60 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-xs">
					<input
						type="number"
						bind:value={customValue}
						min="1"
						class="w-12 text-xs font-bold focus:outline-none bg-transparent"
					/>
					<select
						bind:value={customType}
						class="text-xs font-bold text-slate-500 focus:outline-none bg-transparent"
					>
						<option value="days">Days</option>
						<option value="months">Months</option>
						<option value="years">Years</option>
					</select>
				</div>
			{/if}
			<div class="relative min-w-[140px]">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-dark-green">calendar_month</span>
				<select
					bind:value={activeFilter}
					class="w-full pl-9 pr-8 py-2 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-dark-green focus:outline-none focus:border-primary-green appearance-none cursor-pointer shadow-xs"
				>
					<option value="This Week">This Week</option>
					<option value="This Month">This Month</option>
					<option value="This Quarter">This Quarter</option>
					<option value="Half Yearly">Half Yearly</option>
					<option value="This Year">This Year</option>
					<option value="Custom Range">Custom Range</option>
				</select>
			</div>
			<ExportReportButton 
				reportType="dashboard_summary" 
				dataList={crops} 
				reportOptions={[
					{ value: 'dashboard_summary', label: 'Dashboard Summary' },
					{ value: 'analytics', label: 'Analytics Report' }
				]}
				extraData={{ crops, expenses, inventory, sales }}
				customClass="!rounded-2xl bg-gradient-to-br from-primary-green to-dark-green !text-white !border-0 px-5 py-2 shadow-md shadow-primary-green/20 hover:shadow-primary-green/30 cursor-pointer flex items-center gap-1.5"
			/>
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
					{activeFilter === 'This Month' ? 'Monthly Profit' : 'Period Profit'}
				</p>
				<h3 class="text-2xl font-extrabold {periodProfit < 0 ? 'text-red-650' : 'text-primary-green'} mt-1">
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
					<span class="flex items-center"><span class="size-2.5 rounded-full bg-primary-green mr-1.5"></span> Profit</span>
					<span class="flex items-center"><span class="size-2.5 rounded-full bg-red-600 mr-1.5"></span> Expense</span>
				</div>
			</div>
			<div class="flex-grow relative">
				<canvas id="financialChart"></canvas>
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
