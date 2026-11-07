import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import {
	createManualMediaFx,
	deleteManualCoverFx,
	setManualCoverFx,
	updateManualMediaFx
} from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { saveManualMediaFx } from './model'

const DRAFT = { media_type: 'anime', title: 'Mine' } as ManualDraft
const saved = (ref: string) => Promise.resolve({ media: { media_ref: ref } } as never)
const COVER = { kind: 'url', value: 'https://img/x.jpg', previewUrl: 'x', source: 'url' } as const

describe('saving a hand-made title', () => {
	it('creates it, then sets the cover on the title it created', async () => {
		const calls: string[] = []
		const scope = fork({
			handlers: [
				[createManualMediaFx, () => (calls.push('create'), saved('manual:abc'))],
				[
					setManualCoverFx,
					(params: unknown) => (calls.push(JSON.stringify(params)), saved('manual:abc'))
				]
			]
		})

		const { status, value } = await allSettled(saveManualMediaFx, {
			scope,
			params: { id: null, draft: DRAFT, cover: COVER }
		})

		expect(status).toBe('done')
		expect(value).toEqual({ mediaRef: 'manual:abc', coverSaved: true })
		expect(calls).toEqual(['create', JSON.stringify({ id: 'abc', source: { url: 'https://img/x.jpg' } })])
	})

	it('updates an existing title and removes its cover when asked', async () => {
		const update = vi.fn(() => saved('manual:abc'))
		const removeCover = vi.fn(() => saved('manual:abc'))
		const scope = fork({
			handlers: [
				[updateManualMediaFx, update],
				[deleteManualCoverFx, removeCover]
			]
		})

		await allSettled(saveManualMediaFx, {
			scope,
			params: { id: 'abc', draft: DRAFT, cover: { kind: 'remove' } }
		})

		expect(update).toHaveBeenCalledWith({ id: 'abc', draft: DRAFT })
		expect(removeCover).toHaveBeenCalledWith('abc')
	})

	it('keeps a saved title whose cover failed, and says the cover did not take', async () => {
		const scope = fork({
			handlers: [
				[createManualMediaFx, () => saved('manual:abc')],
				[setManualCoverFx, () => Promise.reject(new Error('too big'))]
			]
		})

		const { status, value } = await allSettled(saveManualMediaFx, {
			scope,
			params: { id: null, draft: DRAFT, cover: COVER }
		})

		expect(status).toBe('done')
		expect(value).toEqual({ mediaRef: 'manual:abc', coverSaved: false })
	})

	it('fails as a whole when the title itself is refused', async () => {
		const setCover = vi.fn()
		const scope = fork({
			handlers: [
				[createManualMediaFx, () => Promise.reject(new Error('invalid'))],
				[setManualCoverFx, setCover]
			]
		})

		const { status } = await allSettled(saveManualMediaFx, {
			scope,
			params: { id: null, draft: DRAFT, cover: COVER }
		})

		expect(status).toBe('fail')
		expect(setCover).not.toHaveBeenCalled()
	})

	it('touches no cover when it is kept', async () => {
		const setCover = vi.fn()
		const removeCover = vi.fn()
		const scope = fork({
			handlers: [
				[updateManualMediaFx, () => saved('manual:abc')],
				[setManualCoverFx, setCover],
				[deleteManualCoverFx, removeCover]
			]
		})

		await allSettled(saveManualMediaFx, {
			scope,
			params: { id: 'abc', draft: DRAFT, cover: { kind: 'keep' } }
		})

		expect(setCover).not.toHaveBeenCalled()
		expect(removeCover).not.toHaveBeenCalled()
	})
})
