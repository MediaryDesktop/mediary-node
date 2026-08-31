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
	}
} as const

export interface NodeConnection {
	baseUrl: string
	wsUrl: string
	token: string
}

export type NodeState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'failed'

export type MediaryBridge = typeof api

contextBridge.exposeInMainWorld('mediary', api)
