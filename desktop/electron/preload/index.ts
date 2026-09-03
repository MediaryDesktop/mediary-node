import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc.js'

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
		version: (): Promise<string> => ipcRenderer.invoke(IPC.appVersion)
	},

	oauth: {
		authorize: (consentUrl: string): Promise<OAuthAuthorization> =>
			ipcRenderer.invoke(IPC.oauthAuthorize, consentUrl)
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
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export type MediaryBridge = typeof api

contextBridge.exposeInMainWorld('mediary', api)
