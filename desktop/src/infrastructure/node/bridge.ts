import { createEffect, createEvent, createStore, sample } from 'effector'

import type { NodeConnection, NodeState } from './bridge-types'

/**
 * The renderer's view of the local node process. Connection details come from
 * main over IPC once (it generated the token, chose the port); everything
 * after that is plain HTTP to loopback, not IPC.
 */

export const nodeBridgeMounted = createEvent()

export const readNodeConnectionFx = createEffect<void, NodeConnection>(() => window.mediary.node.connection())

export const readNodeStateFx = createEffect<void, NodeState>(() => window.mediary.node.state())

/** Pushed by the supervisor whenever the node starts, dies or recovers. */
export const nodeStateChanged = createEvent<NodeState>()

export const $nodeConnection = createStore<NodeConnection | null>(null).on(
	readNodeConnectionFx.doneData,
	(_, connection) => connection
)

export const $nodeState = createStore<NodeState>('stopped')
	.on(readNodeStateFx.doneData, (_, state) => state)
	.on(nodeStateChanged, (_, state) => state)

/** True once the node answers; querying before this fails with a confusing
 * connection error instead of a useful one during the Go process's boot. */
export const $nodeReady = $nodeState.map(state => state === 'ready')

sample({ clock: nodeBridgeMounted, target: [readNodeConnectionFx, readNodeStateFx] })

/** Bridges the IPC push channel into Effector; not a `sample` because the
 * subscription is external to the graph — Electron owns it. */
export function subscribeToNodeState(): () => void {
	return window.mediary.node.onStateChange(state => nodeStateChanged(state))
}

/** The current connection, or a clear failure. Used by the node HTTP client. */
export function requireNodeConnection(): NodeConnection {
	const connection = $nodeConnection.getState()

	if (!connection) {
		throw new Error('node connection is not available yet — wait for $nodeReady before querying the node')
	}

	return connection
}
