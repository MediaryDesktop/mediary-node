export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	/** For headers only: never put it in a URL. */
	token: string
	/** The token for ?token= on the node's media routes and its WebSocket. */
	urlToken: string
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export interface OAuthListener {
	callbackPort: number
}

export interface StoredSession {
	token: string | null
	account: unknown
}

export interface MediaryBridge {
	node: {
		connection: () => Promise<NodeConnection>
		state: () => Promise<NodeState>
		onStateChange: (listener: (state: NodeState) => void) => () => void
	}
	app: {
		version: () => Promise<string>
		booted: () => Promise<void>
	}
	splash: {
		dismiss: () => Promise<void>
	}
	dialog: {
		pickFolder: () => Promise<string | null>
	}
	oauth: {
		prepare: () => Promise<OAuthListener>
		authorize: (consentUrl: string) => Promise<OAuthAuthorization>
		release: () => Promise<void>
	}
	anilist: {
		openAuthorize: (authorizeUrl: string) => Promise<void>
	}
	trailer: {
		host: () => Promise<string>
	}
	session: {
		canPersist: () => Promise<boolean>
		read: () => Promise<StoredSession | null>
		write: (session: StoredSession) => Promise<void>
		clear: () => Promise<void>
	}
	window: {
		minimize: () => Promise<void>
		toggleMaximize: () => Promise<void>
		close: () => Promise<void>
		isMaximized: () => Promise<boolean>
		onMaximizedChange: (listener: (maximized: boolean) => void) => () => void
	}
	platform: string
}

declare global {
	interface Window {
		mediary: MediaryBridge
	}
}
