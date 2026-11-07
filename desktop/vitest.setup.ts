import '@testing-library/jest-dom/vitest'

class ResizeObserverStub implements ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub

// jsdom has neither; the carousel's engine reads both.
class IntersectionObserverStub implements IntersectionObserver {
	readonly root = null
	readonly rootMargin = ''
	readonly thresholds = []
	observe() {}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return []
	}
}

globalThis.IntersectionObserver ??= IntersectionObserverStub

window.matchMedia ??= (query: string) =>
	({
		matches: false,
		media: query,
		onchange: null,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent: () => false
	}) as MediaQueryList

Element.prototype.scrollIntoView ??= () => {}

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
			retry: async () => undefined,
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
		anilist: {
			openAuthorize: async () => {}
		},
		trailer: {
			host: async () => 'http://127.0.0.1:45999'
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
