<script>
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import TextArea from '$lib/components/TextArea.svelte';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();
	
	let rawTodos = $state([]);
	$effect(() => {
		if (data.todos) {
			rawTodos = data.todos;
		}
	});

	// Filter and Sort states
	let searchQuery = $state('');
	let filterStatus = $state('All'); // All, Pending, Completed
	let sortOrder = $state('Newest'); // Newest, Oldest, Due Date

	// Modal states
	let isModalOpen = $state(false);
	let isSubmitting = $state(false);
	let isEditing = $state(false);
	let currentTodoId = $state(null);

	// Form states
	let formTitle = $state('');
	let formDescription = $state('');
	let formPriority = $state('Medium');
	let formDueDate = $state('');

	function openAddModal() {
		isEditing = false;
		currentTodoId = null;
		formTitle = '';
		formDescription = '';
		formPriority = 'Medium';
		formDueDate = '';
		isModalOpen = true;
	}

	function openEditModal(todo) {
		isEditing = true;
		currentTodoId = todo.id;
		formTitle = todo.title;
		formDescription = todo.description;
		formPriority = todo.priority;
		formDueDate = todo.dueDate || '';
		isModalOpen = true;
	}

	function closeModal() {
		isModalOpen = false;
	}

	async function submitForm(e) {
		e.preventDefault();
		if (!formTitle.trim()) return;

		isSubmitting = true;
		try {
			const payload = {
				title: formTitle,
				description: formDescription,
				priority: formPriority,
				dueDate: formDueDate
			};

			if (isEditing) {
				const res = await fetch(`/api/todo/${currentTodoId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					const updated = await res.json();
					rawTodos = rawTodos.map(t => t.id === currentTodoId ? { ...t, ...payload } : t);
					closeModal();
				}
			} else {
				const res = await fetch('/api/todo', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					const newTodo = await res.json();
					rawTodos = [newTodo, ...rawTodos];
					closeModal();
				}
			}
		} catch (error) {
			console.error('Error saving todo:', error);
		} finally {
			isSubmitting = false;
		}
	}

	async function toggleComplete(todo) {
		try {
			const res = await fetch(`/api/todo/${todo.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ completed: !todo.completed })
			});
			if (res.ok) {
				rawTodos = rawTodos.map(t => t.id === todo.id ? { ...t, completed: !todo.completed } : t);
			}
		} catch (error) {
			console.error('Error toggling todo:', error);
		}
	}

	async function deleteTodo(id) {
		if (!confirm('Are you sure you want to delete this task?')) return;
		try {
			const res = await fetch(`/api/todo/${id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				rawTodos = rawTodos.filter(t => t.id !== id);
			}
		} catch (error) {
			console.error('Error deleting todo:', error);
		}
	}

	// Derived lists
	let filteredTodos = $derived.by(() => {
		let list = rawTodos;
		
		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
		}

		// Filter
		if (filterStatus === 'Pending') {
			list = list.filter(t => !t.completed);
		} else if (filterStatus === 'Completed') {
			list = list.filter(t => t.completed);
		}

		// Sort
		list = [...list].sort((a, b) => {
			if (sortOrder === 'Newest') {
				return new Date(b.createdAt) - new Date(a.createdAt);
			} else if (sortOrder === 'Oldest') {
				return new Date(a.createdAt) - new Date(b.createdAt);
			} else if (sortOrder === 'Due Date') {
				if (!a.dueDate) return 1;
				if (!b.dueDate) return -1;
				return new Date(a.dueDate) - new Date(b.dueDate);
			}
			return 0;
		});

		return list;
	});

	function getPriorityColor(priority) {
		if (priority === 'High') return 'text-red-600 bg-red-50 border-red-200';
		if (priority === 'Medium') return 'text-amber-600 bg-amber-50 border-amber-200';
		return 'text-emerald-600 bg-emerald-50 border-emerald-200';
	}

	function getStatusColor(completed) {
		return completed ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-blue-700 bg-blue-50 border-blue-200';
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	let todayDate = new Date();
	todayDate.setHours(0,0,0,0);

	let groupedTodos = $derived.by(() => {
		let completed = [];
		let todayTasks = [];
		let upcoming = [];

		filteredTodos.forEach(todo => {
			if (todo.completed) {
				completed.push(todo);
			} else if (!todo.dueDate) {
				todayTasks.push(todo);
			} else {
				let d = new Date(todo.dueDate);
				d.setHours(0,0,0,0);
				if (d.getTime() <= todayDate.getTime()) {
					todayTasks.push(todo);
				} else {
					upcoming.push(todo);
				}
			}
		});

		return { todayTasks, upcoming, completed };
	});
</script>

<svelte:head>
	<title>Tasks - Agri-Sphere</title>
</svelte:head>

<section class="max-w-md md:max-w-4xl mx-auto px-4 py-4 space-y-6 relative pb-20 md:pb-8">
	<!-- Header -->
	<div class="flex flex-col gap-4">
		<div class="flex justify-between items-center">
			<div>
				<h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">Tasks</h2>
				<p class="text-xs text-slate-500 mt-0.5">Manage your farm activities</p>
			</div>
		<div class="hidden md:block">
			<Button onclick={openAddModal} class="flex items-center gap-2 transition-all duration-200 active:scale-95">
				<span class="material-symbols-outlined text-[20px]">add</span>
				Add Task
			</Button>
		</div>
		</div>

		<!-- Search & Filters -->
		<div class="flex flex-col gap-3">
			<div class="relative w-full">
				<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
				<input 
					type="text" 
					placeholder="Search tasks..." 
					bind:value={searchQuery}
					class="w-full h-10 pl-10 pr-4 bg-slate-100/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<!-- Status Filter -->
				<div class="relative w-full">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-500">filter_list</span>
					<select
						bind:value={filterStatus}
						class="w-full h-10 pl-9 pr-8 bg-slate-100/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer transition-all duration-200"
					>
						<option value="All">All Tasks</option>
						<option value="Pending">Pending</option>
						<option value="Completed">Completed</option>
					</select>
				</div>
				<!-- Sort -->
				<div class="relative w-full">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-500">sort</span>
					<select
						bind:value={sortOrder}
						class="w-full h-10 pl-9 pr-8 bg-slate-100/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer transition-all duration-200"
					>
						<option value="Newest">Newest First</option>
						<option value="Oldest">Oldest First</option>
						<option value="Due Date">By Due Date</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<!-- Task Lists -->
	<div class="space-y-6">
		{#if filteredTodos.length === 0}
			<div class="py-8 flex flex-col items-center justify-center text-center">
				<div class="size-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
					<span class="material-symbols-outlined text-[32px]">assignment</span>
				</div>
				<h3 class="text-lg font-bold text-slate-800">No tasks yet</h3>
				<p class="text-sm text-slate-500 mt-1 mb-6 max-w-xs">
					{searchQuery ? 'No tasks match your search.' : 'Create your first farm task.'}
				</p>
				{#if searchQuery || filterStatus !== 'All'}
					<Button variant="secondary" onclick={() => { searchQuery = ''; filterStatus = 'All'; sortOrder = 'Newest'; }}>
						Clear Filters
					</Button>
				{:else}
					<Button onclick={openAddModal}>Add Your First Task</Button>
				{/if}
			</div>
		{:else}
			{#snippet taskCard(todo)}
				<div class="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 group relative {todo.completed ? 'opacity-75 bg-slate-50/50' : ''}">
					<div class="flex items-start gap-3">
						<button 
							onclick={() => toggleComplete(todo)}
							class="mt-0.5 shrink-0 text-slate-300 hover:text-emerald-500 transition-colors focus:outline-none cursor-pointer active:scale-95"
						>
							{#if todo.completed}
								<span class="material-symbols-outlined text-[22px] text-emerald-500" style="font-variation-settings: 'FILL' 1;">check_circle</span>
							{:else}
								<span class="material-symbols-outlined text-[22px]">radio_button_unchecked</span>
							{/if}
						</button>
						<div class="flex-1 min-w-0 pt-0.5">
							<h3 class="text-sm font-bold text-slate-800 truncate {todo.completed ? 'line-through text-slate-500' : ''}">{todo.title}</h3>
							{#if todo.description}
								<p class="text-xs text-slate-500 mt-1 line-clamp-2">{todo.description}</p>
							{/if}
						</div>
						<!-- Action Menu -->
						<div class="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
							<button onclick={() => openEditModal(todo)} class="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Edit">
								<span class="material-symbols-outlined text-[18px]">edit</span>
							</button>
							<button onclick={() => deleteTodo(todo.id)} class="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
								<span class="material-symbols-outlined text-[18px]">delete</span>
							</button>
						</div>
					</div>
					
					<div class="flex flex-wrap items-center gap-2 ml-9">
						<span class="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 {getPriorityColor(todo.priority)}">
							{todo.priority}
						</span>
						<span class="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 {getStatusColor(todo.completed)}">
							{todo.completed ? 'Completed' : 'Pending'}
						</span>
						{#if todo.dueDate}
							<span class="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold flex items-center gap-1">
								<span class="material-symbols-outlined text-[12px]">calendar_month</span>
								{formatDate(todo.dueDate)}
							</span>
						{/if}
					</div>
				</div>
			{/snippet}

			{#if groupedTodos.todayTasks.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
						<span class="material-symbols-outlined text-[18px] text-emerald-600">today</span> Today's Tasks
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each groupedTodos.todayTasks as todo (todo.id)}
							{@render taskCard(todo)}
						{/each}
					</div>
				</div>
			{/if}

			{#if groupedTodos.upcoming.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
						<span class="material-symbols-outlined text-[18px] text-blue-600">upcoming</span> Upcoming
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each groupedTodos.upcoming as todo (todo.id)}
							{@render taskCard(todo)}
						{/each}
					</div>
				</div>
			{/if}

			{#if groupedTodos.completed.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
						<span class="material-symbols-outlined text-[18px] text-slate-400">task_alt</span> Completed
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each groupedTodos.completed as todo (todo.id)}
							{@render taskCard(todo)}
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</section>

<!-- Mobile FAB -->
<button 
	onclick={openAddModal}
	class="md:hidden fixed bottom-24 right-6 size-14 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200 z-50"
	aria-label="Add Task"
>
	<span class="material-symbols-outlined text-[28px]">add</span>
</button>

<!-- Add/Edit Todo Modal -->
<Modal bind:show={isModalOpen} title={isEditing ? 'Edit Task' : 'Add New Task'}>
	<form onsubmit={submitForm} class="space-y-4 pt-2">
		<Input
			id="todo-title"
			label="Task Title"
			placeholder="E.g., Water the greenhouse tomatoes"
			bind:value={formTitle}
			required
		/>

		<TextArea
			id="todo-desc"
			label="Description (Optional)"
			placeholder="Add more details about this task..."
			bind:value={formDescription}
			rows={3}
		/>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="space-y-1">
				<label for="todo-priority" class="block text-xs font-bold text-slate-700">Priority</label>
				<select
					id="todo-priority"
					bind:value={formPriority}
					class="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 cursor-pointer"
				>
					<option value="Low">Low</option>
					<option value="Medium">Medium</option>
					<option value="High">High</option>
				</select>
			</div>

			<Input
				id="todo-date"
				type="date"
				label="Due Date (Optional)"
				bind:value={formDueDate}
			/>
		</div>

		<div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
			<Button type="button" variant="secondary" onclick={closeModal} disabled={isSubmitting}>Cancel</Button>
			<Button type="submit" disabled={isSubmitting} class="min-w-[120px]">
				{isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Task')}
			</Button>
		</div>
	</form>
</Modal>

