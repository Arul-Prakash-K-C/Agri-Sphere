<script>
	import { fade, slide } from 'svelte/transition';

	let { data } = $props();

	// Reactive states using Svelte 5 runes
	let imageLoaded = $state(false);
	let scanning = $state(false);
	let scanCompleted = $state(false);

	let customImage = $state('');
	let customImageName = $state('');
	
	let selectedLeaf = $derived({
		id: 'custom',
		name: customImageName || 'Uploaded Leaf',
		image: customImage,
		pathogen: 'Custom Analysis',
		confidence: 90,
		severity: 'Moderate',
		treatment: 'Please scan to analyze.',
		field: 'Custom Field'
	});

	let currentDiagnosis = $state(null);

	// History of recent scans
	let recentScans = $state([]);
	$effect(() => {
		recentScans = data.history || [];
	});

	function handleFileUpload(event) {
		const file = event.target.files[0];
		if (!file) return;
		readLeafFile(file);
	}

	function readLeafFile(file) {
		if (scanning) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			customImage = e.target.result;
			customImageName = file.name;
			imageLoaded = true;
			scanCompleted = false;
			currentDiagnosis = {
				id: 'custom',
				name: file.name,
				image: e.target.result,
				pathogen: 'Pending Analysis',
				confidence: 0,
				severity: 'Unknown',
				treatment: 'Click Scan below to diagnose this leaf.',
				field: 'Custom Uploaded'
			};
		};
		reader.readAsDataURL(file);
	}

	function handleDragOver(event) {
		event.preventDefault();
	}

	function handleDrop(event) {
		event.preventDefault();
		if (scanning) return;
		const file = event.dataTransfer.files[0];
		if (file && file.type.startsWith('image/')) {
			readLeafFile(file);
		}
	}

	function handleDropZoneClick() {
		if (scanning) return;
		document.getElementById('leaf-upload-input')?.click();
	}

	async function handleScan() {
		if (!imageLoaded || scanning) return;

		scanning = true;
		scanCompleted = false;

		// Simulated scan delay for UX, then calls BFF API to finalize and save diagnosis
		setTimeout(async () => {
			try {
				const res = await fetch('/api/disease-detection', {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						filename: customImageName,
						imageUrl: selectedLeaf.image
					})
				});

				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Failed to analyze leaf');
				}

				const scanResult = await res.json();
				
				currentDiagnosis = {
					id: 'custom',
					name: selectedLeaf.name,
					image: selectedLeaf.image,
					pathogen: scanResult.pathogen,
					confidence: scanResult.confidence,
					severity: scanResult.severity,
					treatment: scanResult.treatment,
					whyItHappens: scanResult.whyItHappens,
					steps: scanResult.steps,
					field: scanResult.crop || scanResult.field,
					severityTextColor: scanResult.statusColor || 'text-amber-800 bg-amber-50 border-amber-100/50',
					severityColor: scanResult.severity === 'High' ? 'bg-red-500' : (scanResult.severity === 'None' ? 'bg-primary-green' : 'bg-amber-500')
				};

				recentScans = [scanResult, ...recentScans];
				scanning = false;
				scanCompleted = true;
			} catch (err) {
				console.error('Scan error:', err);
				scanning = false;
				alert(err.message);
			}
		}, 1500);
	}

	function handleReset() {
		imageLoaded = false;
		scanCompleted = false;
		scanning = false;
		customImage = '';
		customImageName = '';
		currentDiagnosis = null;
	}
</script>

<svelte:head>
	<title>AI Crop Disease Detection - AgriConnect</title>
</svelte:head>

<section class="max-w-[1440px] mx-auto space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
		<div>
			<h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">AI Crop Disease Detection</h1>
			<p class="text-sm text-slate-500 mt-1">Upload a clear leaf image for real-time web-grounded diagnostic analysis and treatment remedies.</p>
		</div>
	</div>



	<!-- Main Bento Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Upload Area (Left - 7 cols) -->
		<div class="lg:col-span-7 flex flex-col space-y-6">

			<!-- Image Dropzone & Preview Card -->
			<div class="glass-card rounded-2xl p-6 bg-white flex-grow flex flex-col min-h-[420px] justify-between">
				<div class="flex items-center justify-between mb-4">
					<h2 class="font-extrabold text-slate-800 text-base">Leaf Image Input</h2>
					<span class="material-symbols-outlined text-slate-400 cursor-help" title="High resolution JPG or PNG files are recommended">info</span>
				</div>

				<!-- Visual upload box -->
				<!-- Hidden input file element -->
				<input 
					type="file" 
					id="leaf-upload-input" 
					accept="image/*" 
					class="hidden" 
					onchange={handleFileUpload} 
				/>

				<div 
					onclick={handleDropZoneClick}
					onkeydown={(e) => e.key === 'Enter' && handleDropZoneClick()}
					ondragover={handleDragOver}
					ondrop={handleDrop}
					role="button"
					tabindex="0"
					class="flex-grow border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center p-6 relative overflow-hidden group hover:border-primary-green hover:bg-slate-50 transition-all cursor-pointer"
				>
					{#if !imageLoaded}
						<!-- Upload prompt -->
						<div class="flex flex-col items-center text-center space-y-3 py-10" transition:fade={{ duration: 150 }}>
							<div class="w-14 h-14 rounded-full bg-emerald-50 text-primary-green flex items-center justify-center group-hover:scale-105 transition-transform">
								<span class="material-symbols-outlined text-[28px]">cloud_upload</span>
							</div>
							<div>
								<p class="text-xs font-extrabold text-slate-700">Drag & drop leaf image here</p>
								<p class="text-[10px] text-slate-400 font-semibold mt-1">or click to browse files</p>
							</div>
							<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
								JPG, PNG up to 5MB
							</span>
						</div>
					{:else}
						<!-- Scanned Image Preview -->
						<div class="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-900" transition:fade={{ duration: 150 }}>
							<img src={selectedLeaf.image} alt="Selected leaf preview" class="w-full h-full object-cover" />
							
							<!-- Active Scanning Line Animation -->
							{#if scanning}
								<div class="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent scan-line shadow-md shadow-emerald-400/80"></div>
							{/if}

							<!-- Overlay message during scanning -->
							{#if scanning}
								<div class="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center" transition:fade={{ duration: 150 }}>
									<div class="bg-white/95 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-3 shadow-lg border border-slate-100">
										<span class="material-symbols-outlined text-primary-green animate-spin text-[20px]">sync</span>
										<span class="text-xs font-extrabold text-slate-700">AgriConnect AI Analyzing Leaf...</span>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Actions Bar -->
				<div class="mt-5 flex justify-between items-center border-t border-slate-100 pt-4">
					{#if imageLoaded}
						<button 
							onclick={handleReset}
							disabled={scanning}
							class="btn-secondary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
							<span>Remove</span>
						</button>
					{:else}
						<div></div>
					{/if}

					<button 
						onclick={handleScan}
						disabled={!imageLoaded || scanning}
						class="bg-gradient-to-br from-primary-green to-dark-green text-white font-bold text-xs px-6 py-2.5 rounded-full flex items-center justify-center gap-1.5 shadow-md shadow-primary-green/20 hover:shadow-primary-green/45 hover:-translate-y-0.5 transition-all whitespace-nowrap disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
					>
						{#if scanCompleted}
							<span class="material-symbols-outlined text-[18px]">refresh</span>
							<span>Scan Again</span>
						{:else}
							<span class="material-symbols-outlined text-[18px]">document_scanner</span>
							<span>Scan Leaf Image</span>
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Results Section (Right - 5 cols) -->
		<div class="lg:col-span-5 flex flex-col space-y-6">
			<!-- Diagnostic Report -->
			<div 
				class={['glass-card rounded-2xl p-6 bg-white border-t-4 transition-all duration-500 flex flex-col justify-between h-full min-h-[300px]', 
					scanCompleted 
						? (currentDiagnosis?.pathogen?.includes('Healthy') ? 'border-t-emerald-500 border-l-0 shadow-md shadow-emerald-500/5' : 'border-t-red-500 border-l-0 shadow-md shadow-red-500/5') 
						: 'border-t-slate-300 opacity-60 grayscale pointer-events-none'].filter(Boolean).join(' ')}
			>
				<div class="space-y-5">
					<div class="flex justify-between items-start pb-4 border-b border-slate-100">
						<div>
							<h3 class="font-extrabold text-slate-800 text-base">Diagnostic Analysis</h3>
							<p class="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Report details</p>
						</div>
						{#if scanCompleted}
							<span class="bg-emerald-50 text-dark-green border border-emerald-100/50 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1">
								<span class="material-symbols-outlined text-[12px] fill-1">verified</span>
								Verified Scan
							</span>
						{/if}
					</div>

					<div class="space-y-4">
						<!-- Target Pathogen Name -->
						<div>
							<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pathogen / Condition</p>
							<div class="flex justify-between items-end mt-1.5">
								<h2 class={['text-xl font-extrabold tracking-tight leading-none', 
									scanCompleted && !currentDiagnosis?.pathogen?.includes('Healthy') ? 'text-red-500' : 'text-slate-800'].filter(Boolean).join(' ')}>
									{scanCompleted ? currentDiagnosis?.pathogen : 'Pending Scan'}
								</h2>
								<div class="text-right">
									<p class="text-[9px] font-bold text-slate-400 uppercase">AI Confidence</p>
									<p class="text-base font-black text-primary-green leading-none mt-1">
										{scanCompleted ? currentDiagnosis?.confidence : 0}%
									</p>
								</div>
							</div>
						</div>

						<!-- Severity Indicator -->
						<div class="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<div class="w-1.5 h-8 rounded-full bg-slate-300" class:bg-emerald-500={scanCompleted && currentDiagnosis?.severity === 'None'} class:bg-amber-400={scanCompleted && currentDiagnosis?.severity === 'Moderate'} class:bg-red-500={scanCompleted && currentDiagnosis?.severity === 'High'}></div>
								<div>
									<p class="text-[10px] font-bold text-slate-400 uppercase">Severity Class</p>
									<p class="text-xs font-extrabold text-slate-700 mt-0.5">
										{scanCompleted ? currentDiagnosis?.severity : 'Unknown'}
									</p>
								</div>
							</div>
							{#if scanCompleted && currentDiagnosis?.severity !== 'None'}
								<span class={['px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1', currentDiagnosis?.severityTextColor || 'text-amber-800 bg-amber-50 border-amber-100/50'].filter(Boolean).join(' ')}>
									<span class="material-symbols-outlined text-[12px]">warning</span>
									Risk Warning
								</span>
							{/if}
						</div>

						<!-- Why It Happens -->
						<div>
							<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
								<span class="material-symbols-outlined text-[14px]">help_center</span>
								Why It Happens
							</p>
							<div class="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-600 leading-relaxed font-semibold">
								{scanCompleted ? (currentDiagnosis?.whyItHappens || 'N/A') : 'Run detection to understand the primary cause of this condition.'}
							</div>
						</div>

						<!-- Suggested Treatment Actions -->
						<div>
							<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
								<span class="material-symbols-outlined text-[14px]">medication</span>
								Step-by-Step Remedies
							</p>
							<div class="mt-2 space-y-2.5">
								{#if scanCompleted}
									{#if currentDiagnosis?.steps && currentDiagnosis.steps.length > 0}
										{#each currentDiagnosis.steps as step, idx}
											<div class="bg-emerald-50/20 border border-emerald-100/50 rounded-xl p-3 flex items-start gap-3 text-xs text-slate-600 font-semibold" transition:slide={{ duration: 150 }}>
												<span class="w-5 h-5 rounded-full bg-emerald-50 text-dark-green font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
													{idx + 1}
												</span>
												<p class="leading-normal">{step}</p>
											</div>
										{/each}
									{:else}
										<div class="bg-emerald-50/20 border border-emerald-100/50 rounded-xl p-4 text-xs text-slate-600 leading-relaxed font-semibold">
											{currentDiagnosis?.treatment || 'No remedies found.'}
										</div>
									{/if}
								{:else}
									<div class="bg-emerald-50/20 border border-emerald-100/50 rounded-xl p-4 text-xs text-slate-600 leading-relaxed font-semibold">
										Run detection to fetch recommended fungicide treatment, watering updates, and pathogen spread mitigation protocols.
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Recent Scans Mini list -->
			<div class="glass-card rounded-2xl p-5 bg-white space-y-4 shadow-sm border border-slate-200/50">
				<h3 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Recent Leaf Diagnostic Scans</h3>
				
				<div class="divide-y divide-slate-100">
					{#each recentScans as scan (scan.id)}
						<div class="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-100">
									<img src={scan.image} alt={scan.crop} class="w-full h-full object-cover" />
								</div>
								<div>
									<p class="text-xs font-bold text-slate-800">{scan.crop}</p>
									<span class={['inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border mt-0.5', scan.statusColor].filter(Boolean).join(' ')}>
										{scan.pathogen}
									</span>
								</div>
							</div>
							<span class="text-[10px] text-slate-400 font-semibold">{scan.time}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

	</div>
</section>

<style>
	/* Scanning line animation styles */
	.scan-line {
		animation: scan-down 2s ease-in-out infinite;
	}

	@keyframes scan-down {
		0% {
			top: 0%;
		}
		50% {
			top: 100%;
		}
		100% {
			top: 0%;
		}
	}
</style>
