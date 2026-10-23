import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import {
	bookDownloadSettingsQuery,
	enqueueBookDownloadFx,
	fetchBookDownloadSettingsFx,
	putBookDownloadSettingsFx
} from '@entities/book-source'

import { $promptOpen, downloadRequested, folderChosen, promptClosed } from './model'

const book = {
	edition_ref: 'gutenberg:84',
	format: 'application/epub+zip',
	media_ref: 'openlibrary:OL450063W'
}

function setup(rootId: number) {
	const enqueue = vi.fn().mockResolvedValue({ id: 1, state: 'queued' })
	const putSettings = vi.fn().mockImplementation((id: number) => Promise.resolve({ root_id: id }))

	const scope = fork({
		handlers: [
			[fetchBookDownloadSettingsFx, () => Promise.resolve({ root_id: rootId })],
			[enqueueBookDownloadFx, enqueue],
			[putBookDownloadSettingsFx, putSettings]
		]
	})

	return { scope, enqueue, putSettings }
}

describe('downloading a free copy of a book', () => {
	it('queues straight away when a folder for books is chosen', async () => {
		const { scope, enqueue } = setup(3)
		await allSettled(bookDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: book })

		expect(enqueue).toHaveBeenCalledWith(book)
		expect(scope.getState($promptOpen)).toBe(false)
	})

	it('asks for a folder first, then queues the copy', async () => {
		const { scope, enqueue, putSettings } = setup(0)
		await allSettled(bookDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: book })

		expect(enqueue).not.toHaveBeenCalled()
		expect(scope.getState($promptOpen)).toBe(true)

		await allSettled(folderChosen, { scope, params: 7 })

		expect(putSettings).toHaveBeenCalledWith(7)
		expect(enqueue).toHaveBeenCalledWith(book)
		expect(scope.getState($promptOpen)).toBe(false)
	})

	it('drops the copy when the user closes the question', async () => {
		const { scope, enqueue } = setup(0)
		await allSettled(bookDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: book })
		await allSettled(promptClosed, { scope })
		await allSettled(folderChosen, { scope, params: 7 })

		expect(enqueue).not.toHaveBeenCalled()
	})
})
