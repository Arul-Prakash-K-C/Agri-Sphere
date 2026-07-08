import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export const authState = $state({
	user: null,
	profile: null,
	loading: true,
	error: ''
});

let started = false;
let registering = false;

async function setSession(user, profileData = null) {
	if (!user) return;
	try {
		const idToken = await user.getIdToken();
		const response = await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken, profileData })
		});
		
		if (!response.ok) {
			const err = await response.json();
			throw new Error(err.error || 'Failed to initialize server session');
		}

		await invalidateAll();
	} catch (error) {
		console.error('Error setting session:', error);
		authState.error = error.message;
	}
}

async function clearSession() {
	try {
		await fetch('/api/auth', { method: 'DELETE' });
		await invalidateAll();
	} catch (error) {
		console.error('Error clearing session:', error);
	}
}

export function startAuthListener() {
	if (!browser || started) {
		return;
	}

	started = true;

	onAuthStateChanged(auth, async (user) => {
		authState.user = user;
		authState.error = '';

		if (!user) {
			authState.profile = null;
			await clearSession();
			authState.loading = false;
			return;
		}

		if (registering) {
			// Skip automatic session creation during signup to avoid race conditions
			return;
		}

		// Session will be verified/set. Page loader will return the profile.
		if (!authState.profile) {
			authState.loading = true;
			let profileData = null;
			if (browser) {
				const params = new URLSearchParams(window.location.search);
				const roleParam = params.get('role');
				if (roleParam) {
					profileData = { role: roleParam === 'buyer' ? 'customer' : roleParam };
				}
			}
			await setSession(user, profileData);
			authState.loading = false;
		}
	});
}

/**
 * Custom sign up helper that creates the user auth credentials
 * and immediately provisions the profile in Firestore via the BFF API
 */
export async function registerUser({ fullName, email, password, role, ...extra }) {
	const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = await import('firebase/auth');
	
	registering = true;
	authState.loading = true;
	authState.error = '';
	
	try {
		// 1. Create client auth user
		const credential = await createUserWithEmailAndPassword(auth, email, password);
		const user = credential.user;

		// 2. Update display name
		await updateProfile(user, { displayName: fullName });

		// 3. Call BFF to create profile & set session cookie
		const profileData = { fullName, email, role, ...extra };
		await setSession(user, profileData);

		// 4. Send verification email
		await sendEmailVerification(user);

		return user;
	} catch (err) {
		console.error('Sign up error:', err);
		authState.error = err.message;
		throw err;
	} finally {
		registering = false;
		authState.loading = false;
	}
}
