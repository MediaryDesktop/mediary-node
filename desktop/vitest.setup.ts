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
		},
		oauth: {
			prepare: async () => ({ callbackPort: 45123 }),
			authorize: async () => ({ cancelled: true }) as const,
			release: async () => {}
		},
		session: {
			canPersist: async () => true,
			read: async () => null,
			write: async () => {},
			clear: async () => {}
		},
		window: {
			minimize: async () => {},
			toggleMaximize: async () => {},
			close: async () => {},
			isMaximized: async () => false,
			onMaximizedChange: () => () => {}
		},
		platform: 'test'
	}
})
