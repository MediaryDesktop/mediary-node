import svg from '@neodx/svg/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// The subtitle renderer asks for a "desynchronized" canvas, which Chromium on
// Windows presents on its own, outside the page's compositing. With such a canvas
// over a <video> inside a rounded, clipped box (the mini player), the picture
// goes black while the subtitles stay. An ordinary canvas costs a frame of
// latency that subtitles never notice.
const jassubSynchronizedCanvas = (): Plugin => ({
	name: 'jassub-synchronized-canvas',
	enforce: 'pre',
	transform(code, id) {
		if (!id.includes('/jassub/dist/worker/renderers/')) {
			return null
		}

		return code.replaceAll('desynchronized: true', 'desynchronized: false')
	}
})

export default defineConfig({
	main: {
		build: {
			// Bundled rather than left in node_modules, which the package leaves out.
			externalizeDeps: { exclude: ['electron-updater'] },
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

			jassubSynchronizedCanvas(),

			svg({
				inputRoot: 'src/shared/ui/icon/assets',
				output: 'src/public/sprite',

				group: true,
				metadata: 'src/shared/ui/icon/sprite.gen.ts',

				resetColors: true
			})
		],

		// The subtitle renderer's worker splits into chunks, which only ES workers allow.
		worker: { format: 'es', plugins: () => [jassubSynchronizedCanvas()] },

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
			// electron-vite leaves the renderer unminified; for a page read from the
			// app's own disk that is a few megabytes Chromium parses on every start.
			minify: 'esbuild',
			rollupOptions: {
				input: {
					index: dir('./src/index.html'),
					splash: dir('./src/splash.html'),
					pip: dir('./src/pip.html')
				}
			}
		},
		server: {
			port: 5173,
			strictPort: true
		}
	}
})
