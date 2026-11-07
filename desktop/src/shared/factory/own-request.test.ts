import { createMutation } from '@farfetched/core'
import { allSettled, createEffect, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { ownRequest } from './own-request'

function setup() {
	const saveFx = createEffect<{ value: string }, string, { body?: { detail?: string } | null }>()
	const mutation = createMutation({ effect: saveFx })

	return { saveFx, mutation, mine: ownRequest(mutation), theirs: ownRequest(mutation) }
}

describe('ownRequest', () => {
	it('hears the answer to its own request', async () => {
		const { saveFx, mine } = setup()
		const heard = vi.fn()
		mine.succeeded.watch(heard)
		const scope = fork({ handlers: [[saveFx, ({ value }: { value: string }) => Promise.resolve(value)]] })

		await allSettled(mine.sent, { scope, params: { value: 'a' } })

		expect(heard).toHaveBeenCalledWith(expect.objectContaining({ result: 'a' }))
	})

	it('does not hear an answer to someone else sending through the same mutation', async () => {
		const { saveFx, mine, theirs } = setup()
		const heard = vi.fn()
		mine.succeeded.watch(heard)
		const scope = fork({ handlers: [[saveFx, () => Promise.resolve('x')]] })

		await allSettled(theirs.sent, { scope, params: { value: 'b' } })

		expect(heard).not.toHaveBeenCalled()
	})

	it('does not hear its own older request answered after a newer one', async () => {
		const { saveFx, mine } = setup()
		const heard = vi.fn()
		mine.succeeded.watch(heard)
		const answers: Array<() => void> = []
		const scope = fork({
			handlers: [
				[
					saveFx,
					({ value }: { value: string }) =>
						new Promise<string>(resolve => answers.push(() => resolve(value)))
				]
			]
		})

		const first = allSettled(mine.sent, { scope, params: { value: 'old' } })
		const second = allSettled(mine.sent, { scope, params: { value: 'new' } })
		await vi.waitFor(() => expect(answers).toHaveLength(2))
		answers[1]!()
		answers[0]!()
		await Promise.all([first, second])

		expect(heard.mock.calls.map(([done]) => done.result)).toEqual(['new'])
	})

	it('ignores the answer to a request it forgot', async () => {
		const { saveFx, mine } = setup()
		const heard = vi.fn()
		mine.failed.watch(heard)
		let answer = () => {}
		const scope = fork({
			handlers: [
				[saveFx, () => new Promise<string>((_, reject) => (answer = () => reject({ body: null })))]
			]
		})

		const sending = allSettled(mine.sent, { scope, params: { value: 'a' } })
		await vi.waitFor(() => expect(scope.getState(mine.$pending)).toBe(true))
		const forgetting = allSettled(mine.forgotten, { scope })
		answer()
		await Promise.all([sending, forgetting])

		expect(heard).not.toHaveBeenCalled()
	})
})
