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
		globals: true,
		// Two processes, two worlds: the renderer runs in a page, the main process in
		// Node. A main-process test under jsdom would see a `window` it never has.
		projects: [
			{
				extends: true,
				test: {
					name: 'renderer',
					environment: 'jsdom',
					include: ['src/**/*.{test,spec}.{ts,tsx}'],
					setupFiles: ['./vitest.setup.ts']
				}
			},
			{
				extends: true,
				test: {
					name: 'main',
					environment: 'node',
					include: ['electron/**/*.{test,spec}.ts']
				}
			}
		]
	}
})
