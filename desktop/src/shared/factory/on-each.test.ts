import { allSettled, createEvent, createStore, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { onEach } from './on-each'

describe('onEach', () => {
	it('runs on every event, in the scope that fired it', async () => {
		const happened = createEvent<number>()
		const real = vi.fn()
		const effect = onEach(happened, real)

		const replaced = vi.fn()
		const scope = fork({ handlers: [[effect, replaced]] })

		await allSettled(happened, { scope, params: 7 })

		expect(replaced).toHaveBeenCalledWith(7)
		expect(real).not.toHaveBeenCalled()
	})

	it('runs on a store’s updates, not on its initial value', async () => {
		const changed = createEvent<string>()
		const $value = createStore('a').on(changed, (_, next) => next)
		const seen = vi.fn()
		onEach($value.updates, seen)

		const scope = fork()

		expect(seen).not.toHaveBeenCalled()

		await allSettled(changed, { scope, params: 'b' })

		expect(seen).toHaveBeenCalledWith('b')
	})
})
