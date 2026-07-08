<script>
	let {
		currentMonth = $bindable(0),
		currentYear = $bindable(2026),
		events = [],
		prevMonthDays = [],
		nextMonthDays = [],
		totalDaysInMonth = 0,
		firstDayIndexMonday = 0,
		selectedDateKey = $bindable(''),
		onDayClick = null,
		onPrevMonth = null,
		onNextMonth = null,
		filterType = $bindable('All'),
		class: customClass = ''
	} = $props();

	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	const pad = (n) => String(n).padStart(2, '0');

	// Determine if a date key matches today
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

	// Helper to find runs on a specific day
	function getRunsForDay(dNum, mNum, yNum) {
		const key = `${yNum}-${pad(mNum + 1)}-${pad(dNum)}`;
		return events.filter(r => {
			const isMatch = (r.date === dNum && Number(r.month) === mNum && Number(r.year) === yNum) ||
			                (r.postponedFromDateStr === key);
			
			if (!isMatch) return false;
			
			if (filterType === 'All') return true;
			if (filterType === 'Irrigation') return r.type === 'Irrigation' || !r.type;
			if (filterType === 'Fertilizer') return r.type === 'Fertilizer';
			if (filterType === 'Note') return r.type === 'Note' || r.zone?.startsWith('Note:');
			return true;
		});
	}
</script>

<div class={['bg-white dark:bg-[#1e1e1e] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col', customClass].join(' ')}>
	<!-- Header controls -->
	<div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={onPrevMonth}
				class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
			>
				<span class="material-symbols-outlined text-lg leading-none">chevron_left</span>
			</button>
			<h3 class="font-extrabold text-slate-800 dark:text-white text-base min-w-[130px] text-center">
				{monthNames[currentMonth]} {currentYear}
			</h3>
			<button
				type="button"
				onclick={onNextMonth}
				class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
			>
				<span class="material-symbols-outlined text-lg leading-none">chevron_right</span>
			</button>
		</div>

		<!-- Filter Type Tab pills -->
		<div class="flex rounded-xl bg-slate-100 dark:bg-slate-800/40 p-1 border border-slate-200/50 dark:border-slate-700 max-w-sm">
			{#each ['All', 'Irrigation', 'Fertilizer', 'Note'] as type}
				<button
					type="button"
					onclick={() => filterType = type}
					class={[
						'flex-1 px-3 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap',
						filterType === type
							? 'bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm'
							: 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
					].join(' ')}
				>
					{type}
				</button>
			{/each}
		</div>
	</div>

	<!-- Day Labels -->
	<div class="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
		<span>Mon</span>
		<span>Tue</span>
		<span>Wed</span>
		<span>Thu</span>
		<span>Fri</span>
		<span>Sat</span>
		<span>Sun</span>
	</div>

	<!-- Grid cells -->
	<div class="grid grid-cols-7 gap-2">
		<!-- Previous month padded days -->
		{#each prevMonthDays as day}
			{@const runs = getRunsForDay(day.dateNumber, day.month, day.year)}
			<button
				type="button"
				onclick={() => onDayClick?.(day.dateNumber, day.dateKey, runs)}
				class="min-h-[56px] p-2 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 border border-slate-100/50 dark:border-slate-900/30 text-left text-slate-350 dark:text-slate-650 opacity-40 hover:opacity-60 transition-all flex flex-col justify-between cursor-pointer"
			>
				<span class="text-[10px] font-semibold">{day.dateNumber}</span>
				{#if runs.length > 0}
					<span class="size-1.5 rounded-full bg-slate-300 mx-auto"></span>
				{/if}
			</button>
		{/each}

		<!-- Active month days -->
		{#each Array(totalDaysInMonth) as _, idx}
			{@const dayNumber = idx + 1}
			{@const dateKey = `${currentYear}-${pad(currentMonth + 1)}-${pad(dayNumber)}`}
			{@const runs = getRunsForDay(dayNumber, currentMonth, currentYear)}
			{@const isToday = dateKey === todayKey}
			{@const isSelected = dateKey === selectedDateKey}
			
			<button
				type="button"
				onclick={() => onDayClick?.(dayNumber, dateKey, runs)}
				class={[
					'min-h-[56px] p-2 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer',
					isSelected
						? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/10'
						: isToday
						? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
						: 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-slate-800 dark:text-slate-100'
				].join(' ')}
			>
				<span class="text-[10px] font-bold">{dayNumber}</span>
				{#if runs.length > 0}
					<div class="flex flex-wrap gap-0.5 justify-center mt-1 w-full">
						{#each runs.slice(0, 3) as run}
							{@const runType = run.type || (run.zone?.startsWith('Note:') ? 'Note' : 'Irrigation')}
							<span
								class={[
									'size-1.5 rounded-full',
									isSelected
										? 'bg-white'
										: runType === 'Fertilizer'
										? 'bg-amber-500'
										: runType === 'Note'
										? 'bg-blue-500'
										: 'bg-emerald-500'
								].join(' ')}
							></span>
						{/each}
						{#if runs.length > 3}
							<span class={['text-[8px] font-bold shrink-0 leading-none', isSelected ? 'text-white' : 'text-slate-400'].join(' ')}>+</span>
						{/if}
					</div>
				{/if}
			</button>
		{/each}

		<!-- Next month padded days -->
		{#each nextMonthDays as day}
			{@const runs = getRunsForDay(day.dateNumber, day.month, day.year)}
			<button
				type="button"
				onclick={() => onDayClick?.(day.dateNumber, day.dateKey, runs)}
				class="min-h-[56px] p-2 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 border border-slate-100/50 dark:border-slate-900/30 text-left text-slate-350 dark:text-slate-650 opacity-40 hover:opacity-60 transition-all flex flex-col justify-between cursor-pointer"
			>
				<span class="text-[10px] font-semibold">{day.dateNumber}</span>
				{#if runs.length > 0}
					<span class="size-1.5 rounded-full bg-slate-300 mx-auto"></span>
				{/if}
			</button>
		{/each}
	</div>
</div>
