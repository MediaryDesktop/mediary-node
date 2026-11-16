import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { episodeNumber, episodeOrder, episodeSeason, groupTitleFiles, indexEpisodes } from './episodes'

export interface PlayEntry {
	key: string
	season: number | null
	number: number
	position: number
	episode: MediaEpisode | null
	file: LibraryFile | null
	watched: boolean
}

export interface PlayList {
	seasonal: boolean
	seasons: number[]
	entries: PlayEntry[]
	next: PlayEntry | null
	first: PlayEntry | null
}

function slot(season: number | null, number: number): string {
	return `${season ?? ''}:${number}`
}

// An episode with no air date is kept — a local or manual source that never
// gave one is not grounds to hide it. One dated in the future is not out yet.
function isReleased(episode: MediaEpisode | null, now: Date): boolean {
	if (!episode?.air_date) {
		return true
	}

	const date = new Date(`${episode.air_date}T00:00:00Z`)

	return Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()
}

// Every episode the title has, in the order the user's list counts them, each
// with the library file that holds it when there is one. The source's episode
// list leads; without one, the files are all there is to go by. An episode the
// source says has not aired yet is left out — there is nothing to play.
export function playList(
	mediaRef: string,
	files: LibraryFile[],
	episodes: MediaEpisode[],
	progress: number,
	now: Date = new Date()
): PlayList {
	const meta = indexEpisodes(episodes)
	const order = episodeOrder(meta)
	const own = files.filter(file => file.match?.media_ref === mediaRef && !file.missing)
	const main = groupTitleFiles(own, progress, order).main

	const fileAt = new Map<string, LibraryFile>()

	for (const file of main) {
		const number = episodeNumber(file)

		if (number !== null) {
			const at = slot(meta.seasonal ? (episodeSeason(file) ?? 1) : null, number)

			if (!fileAt.has(at)) {
				fileAt.set(at, file)
			}
		}
	}

	const entries: PlayEntry[] =
		meta.list.length > 0
			? meta.list.map((episode, index) => {
					const season = meta.seasonal ? (episode.season ?? 1) : null
					const at = slot(season, episode.number)

					return {
						key: at,
						season,
						number: episode.number,
						position: index + 1,
						episode,
						file: fileAt.get(at) ?? null,
						watched: index + 1 <= progress
					}
				})
			: main.map((file, index) => {
					const number = episodeNumber(file) ?? index + 1
					const position = order(file) ?? index + 1

					return {
						key: `file:${file.id}`,
						season: meta.seasonal ? (episodeSeason(file) ?? 1) : null,
						number,
						position,
						episode: null,
						file,
						watched: position <= progress
					}
				})

	const released = entries.filter(entry => isReleased(entry.episode, now))

	const seasons = meta.seasonal
		? [...new Set(released.map(entry => entry.season ?? 1))].sort((a, b) => a - b)
		: []

	return {
		seasonal: meta.seasonal,
		seasons,
		entries: released,
		next: released.find(entry => !entry.watched) ?? null,
		first: released[0] ?? null
	}
}
