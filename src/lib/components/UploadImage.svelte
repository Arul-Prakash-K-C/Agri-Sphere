<script>
	let {
		uploadedImagePreview = $bindable(''),
		imageUrlValue = $bindable(''),
		class: customClass = ''
	} = $props();

	let imageInputType = $state('url'); // 'url' | 'file'

	function handleFileChange(event) {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedImagePreview = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function handleRemoveUploadedFile() {
		uploadedImagePreview = '';
	}
</script>

<div class={['space-y-2.5', customClass].join(' ')}>
	<div class="flex rounded-xl bg-slate-100 dark:bg-slate-800/40 p-1 border border-slate-200/50 dark:border-slate-700">
		<button
			type="button"
			onclick={() => { imageInputType = 'url'; }}
			class={[
				'flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer',
				imageInputType === 'url'
					? 'bg-white dark:bg-[#1e1e1e] text-slate-850 dark:text-white shadow-sm'
					: 'text-slate-500 hover:text-slate-850 dark:hover:text-white'
			].join(' ')}
		>
			Image URL
		</button>
		<button
			type="button"
			onclick={() => { imageInputType = 'file'; }}
			class={[
				'flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer',
				imageInputType === 'file'
					? 'bg-white dark:bg-[#1e1e1e] text-slate-850 dark:text-white shadow-sm'
					: 'text-slate-500 hover:text-slate-850 dark:hover:text-white'
			].join(' ')}
		>
			Upload Image
		</button>
	</div>

	{#if imageInputType === 'url'}
		<input
			type="url"
			bind:value={imageUrlValue}
			placeholder="https://images.unsplash.com..."
			class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e1e]/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:outline-none transition-all duration-200 text-xs"
		/>
	{:else if uploadedImagePreview}
		<div class="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-28 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
			<img src={uploadedImagePreview} alt="Uploaded preview" class="w-full h-full object-cover" />
			<button
				type="button"
				onclick={handleRemoveUploadedFile}
				class="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
			>
				<span class="material-symbols-outlined text-[14px]">close</span>
			</button>
		</div>
	{:else}
		<label class="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-emerald-650 hover:bg-emerald-50/20 rounded-2xl p-4 cursor-pointer transition-all duration-200 group dark:border-slate-800">
			<span class="material-symbols-outlined text-2xl text-slate-400 group-hover:text-emerald-650 mb-1 transition-colors">cloud_upload</span>
			<span class="text-[10px] text-slate-500 group-hover:text-emerald-650 transition-colors font-bold">Click to upload photo</span>
			<span class="text-[8px] text-slate-450 mt-0.5">PNG, JPG, JPEG up to 5MB</span>
			<input type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
		</label>
	{/if}
</div>
