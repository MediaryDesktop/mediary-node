import type { MediaEpisode } from '@entities/media'

import type { EpisodeIndex } from '@features/continue-watching'

// Past this a list of episodes to stream is a scroll nobody finishes, and each
// row is a poster to load.
export const MAX_EPISODES = 500

export interface StreamItem {
	key: string
	episode?: number
	season?: number
	label: string
	meta: MediaEpisode | undefined
	position: number
}

export interface StreamLabels {
	episode: (number: number) => string
	seasonEpisode: (season: number, number: number) => string
}

// What can be streamed for a title, in watching order: the film itself; every
// episode the catalogue lists by season; or, for a show numbered straight
// through, episodes 1 to the last one out. `position` counts from 1 in that
// order, so it compares with tracker progress directly.
export function streamItems({
	mediaType,
	title,
	meta,
	released,
	labels
}: {
	mediaType: string
	title: string
	meta: EpisodeIndex
	released: number | null
	labels: StreamLabels
}): StreamItem[] {
	if (mediaType === 'movie') {
		return [{ key: 'movie', label: title, meta: undefined, position: 1 }]
	}

	if (meta.seasonal) {
		return meta.list.slice(0, MAX_EPISODES).map((episode, index) => ({
			key: `${episode.season ?? ''}:${episode.number}`,
			episode: episode.number,
			season: episode.season ?? undefined,
			label: labels.seasonEpisode(episode.season ?? 1, episode.number),
			meta: episode,
			position: index + 1
		}))
	}

	return Array.from({ length: Math.min(released ?? 0, MAX_EPISODES) }, (_, index) => {
		const number = index + 1

		return {
			key: `:${number}`,
			episode: number,
			label: labels.episode(number),
			meta: meta.byKey.get(`:${number}`),
			position: number
		}
	})
}

// The next episodes after where the viewer is, for the "up next" rail.
export function upNext(items: StreamItem[], progress: number, size: number): StreamItem[] {
	return items.filter(item => item.position > progress).slice(0, size)
}
