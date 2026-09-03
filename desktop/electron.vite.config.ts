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
