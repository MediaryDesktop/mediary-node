import { combine, createEffect, createEvent, sample } from 'effector'
import type { Event } from 'effector'

import { $nodeConnection, $nodeReady } from './bridge'
import { openNodeEventStream } from './client'

export interface NodeEvent {
	topic: string
	at: string
	payload?: Record<string, unknown>
}

const RECONNECT_DELAY_MS = 2_000

export const nodeEventReceived = createEvent<NodeEvent>()

export const nodeStreamResumed = createEvent()

let openedBefore = false

const $nodeOnline = combine($nodeReady, $nodeConnection, (ready, connection) => ready && connection !== null)

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function parseNodeEvent(data: unknown): NodeEvent | null {
	if (typeof data !== 'string') {
		return null
	}

	try {
		const parsed: unknown = JSON.parse(data)

		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			typeof (parsed as NodeEvent).topic !== 'string'
		) {
			return null
		}

		return parsed as NodeEvent
	} catch {
		return null
	}
}

function closeStream(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer)
		reconnectTimer = null
	}

	const current = socket
	socket = null
	current?.close()
}

const openStreamFx = createEffect(() => {
	closeStream()

	const stream = openNodeEventStream()
	socket = stream

	stream.addEventListener('open', () => {
		if (socket !== stream) {
			return
		}

		if (openedBefore) {
			nodeStreamResumed()
		}
		openedBefore = true
	})

	stream.addEventListener('message', message => {
		const event = parseNodeEvent(message.data)

		if (event) {
			nodeEventReceived(event)
		}
	})

	stream.addEventListener('close', () => {
		if (socket !== stream) {
			return
		}

		socket = null

		if ($nodeOnline.getState()) {
			reconnectTimer = setTimeout(() => void openStreamFx(), RECONNECT_DELAY_MS)
		}
	})
})

const closeStreamFx = createEffect(closeStream)

sample({ clock: $nodeOnline.updates, filter: online => online, target: openStreamFx })
sample({ clock: $nodeConnection.updates, filter: $nodeOnline, target: openStreamFx })
sample({ clock: $nodeOnline.updates, filter: online => !online, target: closeStreamFx })

export function nodeTopic(topic: string): Event<NodeEvent> {
	return nodeEventReceived.filter({ fn: event => event.topic === topic })
}

export const nodeOnline = $nodeOnline.updates.filter({ fn: online => online })
