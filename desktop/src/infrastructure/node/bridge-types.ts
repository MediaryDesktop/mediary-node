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

export interface MediaryBridge {
	node: {
		connection: () => Promise<NodeConnection>
		state: () => Promise<NodeState>
		onStateChange: (listener: (state: NodeState) => void) => () => void
	}
	app: {
		version: () => Promise<string>
	}
}

declare global {
	interface Window {
		mediary: MediaryBridge
	}
}
