import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { fileURLToPath } from 'node:url'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Three builds from one config: the Electron main process, the preload script,
 * and the renderer.
 *
 * The renderer's aliases are the architecture. Every layer boundary in
 * docs/architecture.md is expressed here, in eslint.config.mjs and in
 * tsconfig.web.json — all three have to agree, and all three are checked by
 * `npm run arch:check`.
 */
export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: 'out/main',
			rollupOptions: { input: { index: dir('./electron/main/index.ts') } }
		}
	},

	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: 'out/preload',
			rollupOptions: { input: { index: dir('./electron/preload/index.ts') } }
		}
	},

	renderer: {
		root: dir('./src'),
		plugins: [react()],
		resolve: {
			alias: {
				'@app': dir('./src/app'),
				'@modules': dir('./src/modules'),
				'@core': dir('./src/core'),
				'@ui': dir('./src/ui'),
				'@lib': dir('./src/lib')
			}
		},
		build: {
			outDir: 'out/renderer',
			rollupOptions: { input: dir('./src/index.html') }
		},
		server: {
			port: 5173,
			strictPort: true
		}
	}
})
