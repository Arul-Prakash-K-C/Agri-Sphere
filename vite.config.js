import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

const userCacheId = process.getuid?.() ?? 'user';

export default defineConfig({
	cacheDir:
		process.env.VITE_CACHE_DIR ||
		`/private/tmp/firebaseExample-vite-cache-${userCacheId}`,

	plugins: [tailwindcss(), sveltekit()],

	server: {
		watch: {
			ignored: ['**/.vercel/**']
		}
	},

	build: {
		// Use esbuild for fast, compact output
		minify: 'esbuild',
		// Target modern browsers — reduces polyfill bloat
		target: 'es2020',
		rollupOptions: {
			output: {
				// Split Firebase into its own chunk (it's large and rarely changes)
				manualChunks: (id) => {
					if (id.includes('firebase/app') || id.includes('firebase/auth')) {
						return 'firebase-core';
					}
					if (id.includes('firebase/firestore') || id.includes('firebase/storage')) {
						return 'firebase-db';
					}
					if (id.includes('node_modules')) {
						return 'vendor';
					}
				}
			}
		}
	}
});