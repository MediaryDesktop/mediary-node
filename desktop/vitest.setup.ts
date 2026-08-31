import '@testing-library/jest-dom/vitest'

/**
 * The renderer assumes `window.mediary` exists — it is injected by the preload
 * script, which never runs under jsdom. A default stub here means a test only
 * has to override the parts it cares about, instead of every test reconstructing
 * the whole bridge.
 */
Object.defineProperty(window, 'mediary', {
	writable: true,
	value: {
		node: {
			connection: async () => ({
				baseUrl: 'http://127.0.0.1:43711',
				wsUrl: 'ws://127.0.0.1:43711/ws',
				token: 'test-token'
			}),
			state: async () => 'ready' as const,
			onStateChange: () => () => {}
		},
		app: {
			version: async () => '0.0.0-test'
		}
	}
})
