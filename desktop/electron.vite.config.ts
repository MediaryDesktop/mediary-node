import svg from '@neodx/svg/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { fileURLToPath } from 'node:url'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
	main: {
		build: {
			outDir: 'out/main',
			rollupOptions: { input: { index: dir('./electron/main/index.ts') } }
		}
	},

	preload: {
		build: {
			outDir: 'out/preload',
			rollupOptions: { input: { index: dir('./electron/preload/index.ts') } }
		}
	},

	renderer: {
		root: dir('./src'),
		plugins: [
			react(),

			svg({
				inputRoot: 'src/shared/ui/icon/assets',
				output: 'src/public/sprite',

				group: true,
				metadata: 'src/shared/ui/icon/sprite.gen.ts',

				resetColors: true
			})
		],

		// The subtitle renderer's worker splits into chunks, which only ES workers allow.
		worker: { format: 'es' },

		// Pre-bundling moves the worker away from the .wasm files it finds next to
		// itself, and subtitles silently stop rendering in development.
		// Its CommonJS dependencies still need converting.
		optimizeDeps: {
			exclude: ['jassub'],
			include: ['jassub > throughput', 'jassub > rvfc-polyfill', 'jassub > lfa-ponyfill']
		},
		resolve: {
			alias: {
				'@app': dir('./src/app'),
				'@pages': dir('./src/pages'),
				'@features': dir('./src/features'),
				'@entities': dir('./src/entities'),
				'@infra': dir('./src/infrastructure'),
				'@shared': dir('./src/shared')
			}
		},
		build: {
			outDir: 'out/renderer',
			rollupOptions: { input: { index: dir('./src/index.html'), splash: dir('./src/splash.html') } }
		},
		server: {
			port: 5173,
			strictPort: true
		}
	}
})
