async function apiRequest(url, method = 'GET', data = null) {
	const options = {
		method,
		headers: {}
	};
	if (data) {
		options.headers['Content-Type'] = 'application/json';
		options.body = JSON.stringify(data);
	}
	const res = await fetch(url, options);
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || `Request failed with status ${res.status}`);
	}
	return res.json();
}

export const dbService = {
	// Profile
	getProfile() {
		return apiRequest('/api/profile');
	},
	updateProfile(profileData) {
		return apiRequest('/api/profile', 'PUT', profileData);
	},
	updateFarmerProfile(profileData) {
		return apiRequest('/api/farmer/profile', 'PUT', profileData);
	},
	updateCustomerSettings(settingsData) {
		return apiRequest('/api/customer/settings', 'PUT', settingsData);
	},

	// Crops
	getCrops() {
		return apiRequest('/api/crops');
	},
	getCrop(id) {
		return apiRequest(`/api/crops/${id}`);
	},
	createCrop(cropData) {
		return apiRequest('/api/crops', 'POST', cropData);
	},
	updateCrop(id, cropData) {
		return apiRequest(`/api/crops/${id}`, 'PUT', cropData);
	},
	deleteCrop(id) {
		return apiRequest(`/api/crops/${id}`, 'DELETE');
	},

	// Harvests
	getHarvests() {
		return apiRequest('/api/harvests');
	},
	createHarvest(harvestData) {
		return apiRequest('/api/harvests', 'POST', harvestData);
	},
	updateHarvest(id, harvestData) {
		return apiRequest(`/api/harvests/${id}`, 'PUT', harvestData);
	},
	deleteHarvest(id) {
		return apiRequest(`/api/harvests/${id}`, 'DELETE');
	},

	// Sales
	getSales() {
		return apiRequest('/api/sales');
	},
	createSale(saleData) {
		return apiRequest('/api/sales', 'POST', saleData);
	},
	updateSale(id, saleData) {
		return apiRequest(`/api/sales/${id}`, 'PUT', saleData);
	},
	deleteSale(id) {
		return apiRequest(`/api/sales/${id}`, 'DELETE');
	},

	// Inventory
	getInventory() {
		return apiRequest('/api/inventory');
	},

	// Storages
	getStorages() {
		return apiRequest('/api/storages');
	},
	createStorage(storageData) {
		return apiRequest('/api/storages', 'POST', storageData);
	},
	updateStorage(id, storageData) {
		return apiRequest(`/api/storages/${id}`, 'PUT', storageData);
	},
	deleteStorage(id) {
		return apiRequest(`/api/storages/${id}`, 'DELETE');
	},

	// Expenses
	getExpenses() {
		return apiRequest('/api/expenses');
	},
	createExpense(expenseData) {
		return apiRequest('/api/expenses', 'POST', expenseData);
	},
	updateExpense(id, expenseData) {
		return apiRequest(`/api/expenses/${id}`, 'PUT', expenseData);
	},
	deleteExpense(id) {
		return apiRequest(`/api/expenses/${id}`, 'DELETE');
	},

	// Products
	getProducts(farmerId = null) {
		const url = farmerId ? `/api/products?farmerId=${farmerId}` : '/api/products';
		return apiRequest(url);
	},
	createProduct(productData) {
		return apiRequest('/api/products', 'POST', productData);
	},
	updateProduct(id, productData) {
		return apiRequest(`/api/products/${id}`, 'PUT', productData);
	},
	deleteProduct(id) {
		return apiRequest(`/api/products/${id}`, 'DELETE');
	},

	// Irrigation
	getIrrigation() {
		return apiRequest('/api/irrigation');
	},
	saveIrrigationSchedule(scheduleData) {
		return apiRequest('/api/irrigation', 'POST', scheduleData);
	},
	deleteIrrigationSchedule(id) {
		return apiRequest(`/api/irrigation?id=${id}`, 'DELETE');
	},

	// Disease detection
	getDiseaseDetections() {
		return apiRequest('/api/disease-detection');
	},
	createDiseaseScan(scanData) {
		return apiRequest('/api/disease-detection', 'POST', scanData);
	},
	deleteDiseaseScan(id) {
		return apiRequest(`/api/disease-detection?id=${id}`, 'DELETE');
	}
};
