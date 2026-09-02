/**
 * Types the renderer shares with the Electron preload bridge.
 *
 * They are declared here rather than imported from `electron/preload` because
 * the renderer must never import that module: it runs in a different context
 * and importing it would pull Electron into the browser bundle. The preload
 * script's own types are structurally identical — a mismatch is caught by
 * `npm run typecheck`, which compiles both projects.
 */

export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

/** The pair a provider hands back on the redirect that ends OAuth consent. */
export interface OAuthRedirect {
	code: string
	state: string
}

/** Closing the consent window is an answer, not a failure. */
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
