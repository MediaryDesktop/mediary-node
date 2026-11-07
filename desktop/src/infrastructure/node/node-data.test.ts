import { createQuery } from '@farfetched/core'
import { allSettled, createEffect, createEvent, createStore, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { askWhenReady } from './node-data'

function setup(ready: boolean) {
	const fetchFx = createEffect<string, string>()
	const query = createQuery({ effect: fetchFx })

	const readyChanged = createEvent<boolean>()
	const $ready = createStore(false).on(readyChanged, (_, next) => next)
	const cameUp = createEvent()
	const resumed = createEvent()

	const wanted = askWhenReady(query, { $ready, cameUp, resumed })

	const fetch = vi.fn((params: string) => Promise.resolve(`answer for ${params}`))
	const scope = fork({ values: [[$ready, ready]], handlers: [[fetchFx, fetch]] })

	return { scope, query, wanted, fetch, readyChanged, cameUp, resumed }
}

describe('asking the node for what a screen needs', () => {
	it('asks at once when the node is ready', async () => {
		const { scope, query, wanted, fetch } = setup(true)

		await allSettled(wanted, { scope, params: 'anilist:1' })

		expect(fetch).toHaveBeenCalledWith('anilist:1')
		expect(scope.getState(query.$data)).toBe('answer for anilist:1')
	})

	it('waits while the node is down, then asks the moment it is up', async () => {
		const { scope, query, wanted, fetch, readyChanged, cameUp } = setup(false)

		await allSettled(wanted, { scope, params: 'anilist:1' })
		expect(fetch).not.toHaveBeenCalled()
		expect(scope.getState(query.$failed)).toBe(false)

		await allSettled(readyChanged, { scope, params: true })
		await allSettled(cameUp, { scope })

		expect(fetch).toHaveBeenCalledTimes(1)
		expect(scope.getState(query.$data)).toBe('answer for anilist:1')
	})

	it('asks the last question again after a restart or a reconnect', async () => {
		const { scope, wanted, fetch, cameUp, resumed } = setup(true)

		await allSettled(wanted, { scope, params: 'anilist:1' })
		await allSettled(wanted, { scope, params: 'anilist:2' })
		fetch.mockClear()

		await allSettled(cameUp, { scope })
		await allSettled(resumed, { scope })

		expect(fetch.mock.calls).toEqual([['anilist:2'], ['anilist:2']])
	})

	it('asks nothing after a restart that nobody needed anything from', async () => {
		const { scope, fetch, cameUp, resumed } = setup(true)

		await allSettled(cameUp, { scope })
		await allSettled(resumed, { scope })

		expect(fetch).not.toHaveBeenCalled()
	})
})
