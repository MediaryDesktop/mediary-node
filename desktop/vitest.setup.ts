import '@testing-library/jest-dom/vitest'

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
