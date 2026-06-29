import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

const userCacheId = process.getuid?.() ?? 'user';

export default defineConfig({
	cacheDir:
		process.env.VITE_CACHE_DIR ||
		`/private/tmp/firebaseExample-vite-cache-${userCacheId}`,

	plugins: [tailwindcss(), sveltekit()],

});