import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc.js'
import type { OAuthAuthorization, OAuthListener } from '../shared/oauth.js'
import type { StoredSession } from '../shared/session.js'

const api = {
	node: {
		connection: (): Promise<NodeConnection> => ipcRenderer.invoke(IPC.nodeConnection),

		state: (): Promise<NodeState> => ipcRenderer.invoke(IPC.nodeState),

		onStateChange: (listener: (state: NodeState) => void): (() => void) => {
			const handler = (_event: unknown, state: NodeState) => listener(state)
			ipcRenderer.on(IPC.nodeState, handler)
			return () => {
				ipcRenderer.off(IPC.nodeState, handler)
			}
		}
	},

	app: {
		version: (): Promise<string> => ipcRenderer.invoke(IPC.appVersion),

		// Tells the main process the app has actually booted (node ready, session
		// restored) — it's what the splash window waits on before handing off.
		booted: (): Promise<void> => ipcRenderer.invoke(IPC.appBooted)
	},

	splash: {
		// The splash window's own way out of a boot that never finishes.
		dismiss: (): Promise<void> => ipcRenderer.invoke(IPC.splashDismiss)
	},

	dialog: {
		pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.dialogPickFolder)
	},

	oauth: {
		prepare: (): Promise<OAuthListener> => ipcRenderer.invoke(IPC.oauthPrepare),

		authorize: (consentUrl: string): Promise<OAuthAuthorization> =>
			ipcRenderer.invoke(IPC.oauthAuthorize, consentUrl),

		release: (): Promise<void> => ipcRenderer.invoke(IPC.oauthRelease)
	},

	anilist: {
		openAuthorize: (authorizeUrl: string): Promise<void> =>
			ipcRenderer.invoke(IPC.aniListOpenAuthorize, authorizeUrl)
	},

	trailer: {
		host: (): Promise<string> => ipcRenderer.invoke(IPC.trailerHost)
	},

	session: {
		canPersist: (): Promise<boolean> => ipcRenderer.invoke(IPC.sessionCanPersist),
		read: (): Promise<StoredSession | null> => ipcRenderer.invoke(IPC.sessionRead),
		write: (session: StoredSession): Promise<void> => ipcRenderer.invoke(IPC.sessionWrite, session),
		clear: (): Promise<void> => ipcRenderer.invoke(IPC.sessionClear)
	},

	window: {
		minimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
		toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IPC.windowToggleMaximize),
		close: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),

		isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowIsMaximized),

		onMaximizedChange: (listener: (maximized: boolean) => void): (() => void) => {
			const handler = (_event: unknown, maximized: boolean) => listener(maximized)
			ipcRenderer.on(IPC.windowIsMaximized, handler)
			return () => {
				ipcRenderer.off(IPC.windowIsMaximized, handler)
			}
		}
	},

	platform: process.platform
} as const

export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
	urlToken: string
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

export type { OAuthAuthorization, OAuthListener, OAuthRedirect } from '../shared/oauth.js'
export type { StoredSession } from '../shared/session.js'

export type MediaryBridge = typeof api

contextBridge.exposeInMainWorld('mediary', api)
