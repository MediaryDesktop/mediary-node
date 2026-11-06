import { createWatch } from 'effector'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { nodeEventReceived, nodeStreamResumed, receiveNodeMessage } from './events'

describe('receiveNodeMessage', () => {
	const unwatch: Array<() => void> = []

	afterEach(() => {
		unwatch.splice(0).forEach(stop => stop())
	})

	function watch() {
		const received = vi.fn()
		const resumed = vi.fn()

		unwatch.push(createWatch({ unit: nodeEventReceived, fn: received }).unsubscribe)
		unwatch.push(createWatch({ unit: nodeStreamResumed, fn: resumed }).unsubscribe)

		return { received, resumed }
	}

	it('passes an ordinary event on', () => {
		const { received, resumed } = watch()

		receiveNodeMessage(JSON.stringify({ topic: 'torrent', at: '2026-11-06T00:00:00Z' }))

		expect(received).toHaveBeenCalledWith(expect.objectContaining({ topic: 'torrent' }))
		expect(resumed).not.toHaveBeenCalled()
	})

	// Events were lost on the way: everything that listens for a reconnect
	// reloads, instead of trusting a stream with a gap in it.
	it('treats an overflow as a resumed stream', () => {
		const { received, resumed } = watch()

		receiveNodeMessage(JSON.stringify({ topic: 'hub.overflow', at: '2026-11-06T00:00:00Z' }))

		expect(resumed).toHaveBeenCalledOnce()
		expect(received).not.toHaveBeenCalled()
	})

	it('ignores what is not an event', () => {
		const { received, resumed } = watch()

		receiveNodeMessage('not json')
		receiveNodeMessage(JSON.stringify({ at: 'no topic' }))

		expect(received).not.toHaveBeenCalled()
		expect(resumed).not.toHaveBeenCalled()
	})
})
