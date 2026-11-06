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

sample({
	clock: candidatesChanged,
	source: $episodes,
	fn: (known, candidates) =>
		candidates.map(candidate => candidate.mediaRef).filter(mediaRef => !(mediaRef in known)),
	filter: (known, candidates) => candidates.some(candidate => !(candidate.mediaRef in known)),
	target: loadEpisodesFx
})

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
