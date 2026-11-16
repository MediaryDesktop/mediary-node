import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { setChapterReadFx, setEpisodeWatchedFx } from '@entities/progress'
import { updateTrackerEntryFx } from '@entities/tracker'

import { chapterMarked, episodeMarked } from './model'

function setup({ listFails = false } = {}) {
	const watched = vi.fn().mockResolvedValue({})
	const read = vi.fn().mockResolvedValue({})
	const list = listFails ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue({})

	const scope = fork({
		handlers: [
			[setEpisodeWatchedFx, watched],
			[setChapterReadFx, read],
			[updateTrackerEntryFx, list]
		]
	})

	return { scope, watched, read, list }
}

const TITLE = 'anilist:154587'

describe('marking an episode', () => {
	it('marks it on the node and raises the list to it', async () => {
		const { scope, watched, list } = setup()

		await allSettled(episodeMarked, {
			scope,
			params: { mediaRef: TITLE, episode: 7, watched: true, progress: 3, listed: true }
		})

		expect(watched).toHaveBeenCalledWith({ mediaRef: TITLE, episode: 7, watched: true })
		expect(list).toHaveBeenCalledWith({ mediaRef: TITLE, patch: { progress: 7 } })
	})

	it('leaves the list alone when the episode is already under it', async () => {
		const { scope, watched, list } = setup()

		await allSettled(episodeMarked, {
			scope,
			params: { mediaRef: TITLE, episode: 2, watched: true, progress: 3, listed: true }
		})

		expect(watched).toHaveBeenCalledTimes(1)
		expect(list).not.toHaveBeenCalled()
	})

	it('keeps the mark when the list could not take it', async () => {
		const { scope, watched } = setup({ listFails: true })

		await allSettled(episodeMarked, {
			scope,
			params: { mediaRef: TITLE, episode: 1, watched: true, progress: 0, listed: false }
		})

		expect(watched).toHaveBeenCalledWith({ mediaRef: TITLE, episode: 1, watched: true })
	})
})

describe('marking a chapter', () => {
	it('marks it on the node and puts a title not on any list on it', async () => {
		const { scope, read, list } = setup()

		await allSettled(chapterMarked, {
			scope,
			params: { mediaRef: TITLE, chapter: '12', read: true, progress: 0, listed: false }
		})

		expect(read).toHaveBeenCalledWith({ mediaRef: TITLE, chapter: '12', read: true })
		expect(list).toHaveBeenCalledWith({ mediaRef: TITLE, patch: { status: 'CURRENT', progress: 12 } })
	})

	it('sends nothing to the node for an extra without a number', async () => {
		const { scope, read, list } = setup()

		await allSettled(chapterMarked, {
			scope,
			params: { mediaRef: TITLE, chapter: null, read: true, progress: 4, listed: true }
		})

		expect(read).not.toHaveBeenCalled()
		expect(list).not.toHaveBeenCalled()
	})
})
