import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import {
	enqueueMangaDownloadsFx,
	fetchMangaDownloadSettingsFx,
	mangaDownloadSettingsQuery,
	putMangaDownloadSettingsFx
} from '@entities/manga-source'

import { $promptOpen, downloadRequested, folderChosen } from './model'

function setup(rootId: number, defaultFolder = '') {
	const enqueue = vi.fn().mockResolvedValue({ downloads: [] })
	const putSettings = vi
		.fn()
		.mockImplementation((id: number) => Promise.resolve({ root_id: id, default_folder: defaultFolder }))

	const scope = fork({
		handlers: [
			[
				fetchMangaDownloadSettingsFx,
				() => Promise.resolve({ root_id: rootId, default_folder: defaultFolder })
			],
			[enqueueMangaDownloadsFx, enqueue],
			[putMangaDownloadSettingsFx, putSettings]
		]
	})

	return { scope, enqueue, putSettings }
}

describe('downloading chapters', () => {
	it('queues straight away when a folder is chosen', async () => {
		const { scope, enqueue } = setup(3)
		await allSettled(mangaDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: ['opds:1:a'] })

		expect(enqueue).toHaveBeenCalledWith(['opds:1:a'])
		expect(scope.getState($promptOpen)).toBe(false)
	})

	it('queues straight away into the node’s own folder when none is chosen', async () => {
		const { scope, enqueue } = setup(0, 'C:\\Mediary\\manga')
		await allSettled(mangaDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: ['opds:1:a'] })

		expect(enqueue).toHaveBeenCalledWith(['opds:1:a'])
		expect(scope.getState($promptOpen)).toBe(false)
	})

	it('asks for a folder first when the node has none, then queues what was asked for', async () => {
		const { scope, enqueue, putSettings } = setup(0)
		await allSettled(mangaDownloadSettingsQuery.start, { scope })

		await allSettled(downloadRequested, { scope, params: ['opds:1:a', 'opds:1:b'] })

		expect(enqueue).not.toHaveBeenCalled()
		expect(scope.getState($promptOpen)).toBe(true)

		await allSettled(folderChosen, { scope, params: 7 })

		expect(putSettings).toHaveBeenCalledWith(7)
		expect(enqueue).toHaveBeenCalledWith(['opds:1:a', 'opds:1:b'])
		expect(scope.getState($promptOpen)).toBe(false)
	})
})
