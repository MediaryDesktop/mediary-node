import { combine, createEffect, createEvent, createStore, sample } from 'effector'

import { fetchTitleFilesFx } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import { fetchMediaEpisodesFx } from '@entities/media'
import type { MediaEpisode } from '@entities/media'

import { upNext } from '../lib/up-next'
import type { UpNext } from '../lib/up-next'

export interface Candidate {
	mediaRef: string
	progress: number
}

export interface UpNextItem extends UpNext {
	mediaRef: string
}

export const candidatesChanged = createEvent<Candidate[]>()

const $candidates = createStore<Candidate[]>([]).on(candidatesChanged, (_, next) => next)

// Each title's files, asked for one by one: the node keeps them per title, and a
// title that fails to answer must not hide the rest.
const loadFilesFx = createEffect(async (refs: string[]): Promise<Record<string, LibraryFile[]>> => {
	const answers = await Promise.allSettled(
		refs.map(mediaRef => fetchTitleFilesFx({ mediaRef, kind: 'video' }))
	)
	const files: Record<string, LibraryFile[]> = {}

	refs.forEach((mediaRef, index) => {
		const answer = answers[index]
		if (answer?.status === 'fulfilled') {
			files[mediaRef] = answer.value.files.items ?? []
		}
	})

	return files
})

// Episode lists come from the sources through the node's cache. A title whose list
// does not come stays empty, and its files are counted by their own numbers.
const loadEpisodesFx = createEffect(async (refs: string[]): Promise<Record<string, MediaEpisode[]>> => {
	const answers = await Promise.allSettled(refs.map(mediaRef => fetchMediaEpisodesFx(mediaRef)))
	const episodes: Record<string, MediaEpisode[]> = {}

	refs.forEach((mediaRef, index) => {
		const answer = answers[index]
		episodes[mediaRef] = answer?.status === 'fulfilled' ? (answer.value.episodes.episodes ?? []) : []
	})

	return episodes
})

const $files = createStore<Record<string, LibraryFile[]>>({}).on(loadFilesFx.doneData, (state, files) => ({
	...state,
	...files
}))

const $episodes = createStore<Record<string, MediaEpisode[]>>({}).on(
	loadEpisodesFx.doneData,
	(state, episodes) => ({ ...state, ...episodes })
)

sample({
	clock: candidatesChanged,
	fn: candidates => candidates.map(candidate => candidate.mediaRef),
	target: loadFilesFx
})

// An episode list hardly changes while the app is open; it is asked for once.
sample({
	clock: candidatesChanged,
	source: $episodes,
	fn: (known, candidates) =>
		candidates.map(candidate => candidate.mediaRef).filter(mediaRef => !(mediaRef in known)),
	filter: (known, candidates) => candidates.some(candidate => !(candidate.mediaRef in known)),
	target: loadEpisodesFx
})

// A show numbered by season waits for its episode list: without it S02E01 would
// read as the first episode.
export const $items = combine($candidates, $files, $episodes, (candidates, files, episodes) =>
	candidates.flatMap(({ mediaRef, progress }): UpNextItem[] => {
		const titleFiles = files[mediaRef]
		const list = episodes[mediaRef]

		if (!titleFiles || (mediaRef.startsWith('tmdb:tv:') && !list)) {
			return []
		}

		const next = upNext(mediaRef, titleFiles, list ?? [], progress)

		return next ? [{ mediaRef, ...next }] : []
	})
)

export const $loading = combine(
	loadFilesFx.pending,
	$files,
	(pending, files) => pending && Object.keys(files).length === 0
)
