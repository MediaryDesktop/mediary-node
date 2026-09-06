import { createEffect, createEvent, createStore, sample } from 'effector'

import type { NodeConnection, NodeState } from '@shared/bridge'

export const nodeBridgeMounted = createEvent()

export const readNodeConnectionFx = createEffect<void, NodeConnection>(() => window.mediary.node.connection())

export const readNodeStateFx = createEffect<void, NodeState>(() => window.mediary.node.state())

export const nodeStateChanged = createEvent<NodeState>()

export const $nodeConnection = createStore<NodeConnection | null>(null).on(
	readNodeConnectionFx.doneData,
	(_, connection) => connection
)

export const $nodeState = createStore<NodeState>('stopped')
	.on(readNodeStateFx.doneData, (_, state) => state)
	.on(nodeStateChanged, (_, state) => state)

export const $nodeReady = $nodeState.map(state => state === 'ready')

sample({ clock: nodeBridgeMounted, target: [readNodeConnectionFx, readNodeStateFx] })

sample({
	clock: nodeStateChanged,
	filter: (state: NodeState) => state === 'ready',
	target: readNodeConnectionFx
})

export function subscribeToNodeState(): () => void {
	return window.mediary.node.onStateChange(state => nodeStateChanged(state))
}

export function requireNodeConnection(): NodeConnection {
	const connection = $nodeConnection.getState()

	if (!connection) {
		throw new Error('node connection is not available yet — wait for $nodeReady before querying the node')
	}

	return connection
}
