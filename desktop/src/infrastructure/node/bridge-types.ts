export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export interface MediaryBridge {
	node: {
		connection: () => Promise<NodeConnection>
		state: () => Promise<NodeState>
		onStateChange: (listener: (state: NodeState) => void) => () => void
	}
	app: {
		version: () => Promise<string>
	}
	oauth: {
		authorize: (consentUrl: string) => Promise<OAuthAuthorization>
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
