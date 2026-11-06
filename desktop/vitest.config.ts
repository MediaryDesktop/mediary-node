import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
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
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.{test,spec}.{ts,tsx}', 'electron/**/*.{test,spec}.ts'],
		setupFiles: ['./vitest.setup.ts']
	}
})
