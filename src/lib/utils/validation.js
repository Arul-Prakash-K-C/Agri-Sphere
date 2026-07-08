export function validateStep1(fullName, email, phone) {
	return (fullName || '').trim().length > 0 && 
	       (email || '').includes('@') && 
	       (phone || '').trim().length >= 8;
}

export function validateStep2(password, confirmPassword) {
	return (password || '').length >= 6 && password === confirmPassword;
}

export function validateStep3(role, { farmName, farmArea, address, adminAccessCode }) {
	if (role === 'farmer') {
		return (farmName || '').trim().length > 0 && 
		       Number(farmArea) > 0 && 
		       (address || '').trim().length > 0;
	}
	if (role === 'customer') {
		return (address || '').trim().length > 0;
	}
	if (role === 'admin') {
		return (adminAccessCode || '').trim() === 'AGRI-ADMIN-2026';
	}
	return true;
}
