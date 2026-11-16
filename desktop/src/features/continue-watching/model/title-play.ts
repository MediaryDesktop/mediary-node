import { createEffect, createEvent, createStore, sample } from 'effector'

import { fetchTitleFilesFx } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import { fetchMediaEpisodesFx } from '@entities/media'
import type { MediaEpisode } from '@entities/media'

// The files and episodes of any title a card's play menu is opened for, kept by
// title: the media page's own queries hold one title at a time, and a card on
// that page asking for another would take them from it.
export const titlePlayRequested = createEvent<string>()

const loadFilesFx = createEffect(async (mediaRef: string): Promise<LibraryFile[]> => {
	const answer = await fetchTitleFilesFx({ mediaRef, kind: 'video' })
	return answer.files.items ?? []
})

const loadEpisodesFx = createEffect(async (mediaRef: string): Promise<MediaEpisode[]> => {
	const answer = await fetchMediaEpisodesFx(mediaRef)
	return answer.episodes.episodes ?? []
})

export const $titleFiles = createStore<Record<string, LibraryFile[]>>({}).on(
	loadFilesFx.done,
	(state, { params, result }) => ({ ...state, [params]: result })
)

export const $titleEpisodes = createStore<Record<string, MediaEpisode[]>>({})
	.on(loadEpisodesFx.done, (state, { params, result }) => ({ ...state, [params]: result }))
	.on(loadEpisodesFx.fail, (state, { params }) => ({ ...state, [params]: [] }))

sample({ clock: titlePlayRequested, target: loadFilesFx })

sample({
	clock: titlePlayRequested,
	source: $titleEpisodes,
	filter: (known, mediaRef) => !(mediaRef in known),
	fn: (_, mediaRef) => mediaRef,
	target: loadEpisodesFx
})
