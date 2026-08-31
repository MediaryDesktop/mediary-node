import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
	resolve: {
		alias: {
			'@app': dir('./src/app'),
			'@modules': dir('./src/modules'),
			'@core': dir('./src/core'),
			'@ui': dir('./src/ui'),
			'@lib': dir('./src/lib')
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		setupFiles: ['./vitest.setup.ts']
	}
})
