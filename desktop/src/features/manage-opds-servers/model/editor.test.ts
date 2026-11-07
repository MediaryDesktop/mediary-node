import { createMutation } from '@farfetched/core'
import { allSettled, createEffect, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import type { RequestFailure } from '@shared/api'

import type { CheckParams, ServerBody } from '../lib/form'

import { createServerEditor } from './editor'
import type { CheckOutcome } from './editor'

type Failure = RequestFailure['error']

const SAVED = { id: 7, name: 'Komga', url: 'http://nas/opds', username: 'me', has_password: true }

function setup() {
	const createFx = createEffect<ServerBody, unknown, Failure>()
	const updateFx = createEffect<{ id: number; body: ServerBody }, unknown, Failure>()
	const checkFx = createEffect<CheckParams, CheckOutcome, Failure>()

	const units = {
		create: createMutation({ effect: createFx }),
		update: createMutation({ effect: updateFx }),
		check: createMutation({ effect: checkFx })
	}

	return { units, createFx, updateFx, checkFx, editor: createServerEditor(units) }
}

describe('OPDS server editor', () => {
	it('creates a new server from what was typed and closes', async () => {
		const { editor, createFx } = setup()
		const create = vi.fn(() => Promise.resolve({}))
		const scope = fork({ handlers: [[createFx, create]] })

		await allSettled(editor.opened, { scope, params: null })
		await allSettled(editor.changed, { scope, params: { name: 'Komga', url: 'http://nas/opds' } })
		await allSettled(editor.submitted, { scope })

		expect(create).toHaveBeenCalledWith({
			name: 'Komga',
			url: 'http://nas/opds',
			username: '',
			password: ''
		})
		expect(scope.getState(editor.$editing)).toBeNull()
	})

	it('updates the server being edited, keeping its password', async () => {
		const { editor, updateFx } = setup()
		const update = vi.fn(() => Promise.resolve({}))
		const scope = fork({ handlers: [[updateFx, update]] })

		await allSettled(editor.opened, { scope, params: SAVED })
		await allSettled(editor.changed, { scope, params: { name: 'Komga at home' } })
		await allSettled(editor.submitted, { scope })

		expect(update).toHaveBeenCalledWith({
			id: 7,
			body: { name: 'Komga at home', url: 'http://nas/opds', username: 'me', password: undefined }
		})
	})

	it('does not send a server without a name or an address', async () => {
		const { editor, createFx } = setup()
		const create = vi.fn(() => Promise.resolve({}))
		const scope = fork({ handlers: [[createFx, create]] })

		await allSettled(editor.opened, { scope, params: null })
		await allSettled(editor.submitted, { scope })

		expect(create).not.toHaveBeenCalled()
		expect(scope.getState(editor.$editing)).toEqual({ item: null })
	})

	it('ignores a save it did not send', async () => {
		const { units, editor, createFx } = setup()
		const scope = fork({ handlers: [[createFx, () => Promise.resolve({})]] })

		await allSettled(editor.opened, { scope, params: SAVED })
		await allSettled(units.create.start, { scope, params: { name: 'Other', url: 'http://elsewhere' } })

		expect(scope.getState(editor.$editing)).toEqual({ item: SAVED })
	})

	it('reports its own failed save and stays open', async () => {
		const { editor, createFx } = setup()
		const failed = vi.fn()
		const scope = fork({
			handlers: [[createFx, () => Promise.reject({ body: { detail: 'taken' } })]]
		})
		editor.saveFailed.watch(failed)

		await allSettled(editor.opened, { scope, params: null })
		await allSettled(editor.changed, { scope, params: { name: 'Komga', url: 'http://nas/opds' } })
		await allSettled(editor.submitted, { scope })

		expect(failed).toHaveBeenCalledWith({ body: { detail: 'taken' } })
		expect(scope.getState(editor.$editing)).toEqual({ item: null })
	})

	it('shows the answer to its check', async () => {
		const { editor, checkFx } = setup()
		const scope = fork({ handlers: [[checkFx, () => Promise.resolve({ ok: true })]] })

		await allSettled(editor.opened, { scope, params: SAVED })
		await allSettled(editor.checked, { scope })

		expect(scope.getState(editor.$check)).toEqual({ ok: true })
	})

	it('drops a check answer that arrives after the address changed', async () => {
		const { editor, checkFx } = setup()
		let answer = () => {}
		const scope = fork({
			handlers: [
				[checkFx, () => new Promise<CheckOutcome>(resolve => (answer = () => resolve({ ok: true })))]
			]
		})

		await allSettled(editor.opened, { scope, params: SAVED })
		const checking = allSettled(editor.checked, { scope })
		await vi.waitFor(() => expect(scope.getState(editor.$checking)).toBe(true))

		const typing = allSettled(editor.changed, { scope, params: { url: 'http://typo' } })
		await vi.waitFor(() => expect(scope.getState(editor.$fields).url).toBe('http://typo'))
		answer()
		await Promise.all([checking, typing])

		expect(scope.getState(editor.$check)).toBeNull()
	})

	it('drops an older check answered after a newer one', async () => {
		const { editor, checkFx } = setup()
		const answers: Array<() => void> = []
		let calls = 0
		const scope = fork({
			handlers: [
				[
					checkFx,
					() => {
						const ok = calls++ > 0
						return new Promise<CheckOutcome>(resolve => answers.push(() => resolve({ ok })))
					}
				]
			]
		})

		await allSettled(editor.opened, { scope, params: SAVED })
		const first = allSettled(editor.checked, { scope })
		const second = allSettled(editor.checked, { scope })
		await vi.waitFor(() => expect(answers).toHaveLength(2))

		answers[1]!()
		answers[0]!()
		await Promise.all([first, second])

		expect(scope.getState(editor.$check)).toEqual({ ok: true })
	})
})
