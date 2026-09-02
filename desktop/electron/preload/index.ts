import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc.js'

/**
 * The whole main→renderer surface — deliberately tiny. The renderer talks to
 * the node over HTTP, not IPC, so this only hands over connection details and
 * supervisor state. Every added method widens the sandbox's attack surface.
 */
const api = {
	node: {
		/** Where the local node listens and the token every request must carry. */
		connection: (): Promise<NodeConnection> => ipcRenderer.invoke(IPC.nodeConnection),

		/** The supervisor's state right now. */
		state: (): Promise<NodeState> => ipcRenderer.invoke(IPC.nodeState),

		/** Subscribe to supervisor state changes. Returns an unsubscribe function. */
		onStateChange: (listener: (state: NodeState) => void): (() => void) => {
			const handler = (_event: unknown, state: NodeState) => listener(state)
			ipcRenderer.on(IPC.nodeState, handler)
			return () => {
				ipcRenderer.off(IPC.nodeState, handler)
			}
		}
	},

	app: {
		version: (): Promise<string> => ipcRenderer.invoke(IPC.appVersion)
	},

	oauth: {
		/**
		 * Opens the provider's consent page in a window main owns and resolves
		 * with the redirect it intercepts, or with `{ cancelled: true }` if the
		 * user closed it.
		 */
		authorize: (consentUrl: string): Promise<OAuthAuthorization> =>
			ipcRenderer.invoke(IPC.oauthAuthorize, consentUrl)
	},

	/**
	 * The window is frameless (`electron/main/index.ts`), so these are the only
	 * way to minimize, maximize or close it — see `shared/ui/window-controls`.
	 */
	window: {
		minimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
		toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IPC.windowToggleMaximize),
		close: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),

		/** Whether the window is maximized right now. */
		isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowIsMaximized),

		/** Subscribe to maximize/restore, however it happens — button, double-click
		 * the drag strip, Windows Snap. Returns an unsubscribe function. */
		onMaximizedChange: (listener: (maximized: boolean) => void): (() => void) => {
			const handler = (_event: unknown, maximized: boolean) => listener(maximized)
			ipcRenderer.on(IPC.windowIsMaximized, handler)
			return () => {
				ipcRenderer.off(IPC.windowIsMaximized, handler)
			}
		}
	},

	/** `darwin` | `win32` | `linux` — which side draws the caption buttons. */
	platform: process.platform
} as const

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

export type MediaryBridge = typeof api

contextBridge.exposeInMainWorld('mediary', api)
