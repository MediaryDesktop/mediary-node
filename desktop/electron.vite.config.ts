import svg from '@neodx/svg/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
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
			/*
			 * Icons: every `src/shared/ui/icon/assets/<group>/<name>.svg` becomes a
			 * symbol in `src/public/sprite/<group>.svg`, and the generated metadata
			 * gives `Icon` its `name` union plus each symbol's real viewBox.
			 *
			 * Paths are relative to the package directory (the plugin's own vfs
			 * root), not to the renderer `root` above.
			 */
			svg({
				inputRoot: 'src/shared/ui/icon/assets',
				output: 'src/public/sprite',
				// One sprite per asset folder, so a screen pays for the group it
				// uses instead of downloading every icon in the app.
				group: true,
				metadata: 'src/shared/ui/icon/sprite.gen.ts',
				// The glyphs are stroke-only and already say `currentColor`; this
				// keeps a designer's hardcoded fill from slipping in later.
				resetColors: true
			})
		],
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
			rollupOptions: { input: dir('./src/index.html') }
		},
		server: {
			port: 5173,
			strictPort: true
		}
	}
})
