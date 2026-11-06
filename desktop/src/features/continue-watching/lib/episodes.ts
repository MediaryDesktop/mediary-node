import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

export interface TitleEpisodes {
	main: LibraryFile[]
	specials: LibraryFile[]
	others: LibraryFile[]

	toWatch: LibraryFile[]
}

export type EpisodeOrder = (file: LibraryFile) => number | null

export function episodeNumber(file: LibraryFile): number | null {
	return file.match?.episode ?? file.parsed.episode ?? null
}

export function episodeSeason(file: LibraryFile): number | null {
	return file.match?.season ?? file.parsed.season ?? null
}

export function isWatched(file: LibraryFile, progress: number, order: EpisodeOrder = episodeNumber): boolean {
	const number = order(file)

	return number === null ? progress > 0 : number <= progress
}

export function groupTitleFiles(
	files: LibraryFile[],
	progress: number,
	order: EpisodeOrder = episodeNumber
): TitleEpisodes {
	const main: LibraryFile[] = []
	const specials: LibraryFile[] = []
	const others: LibraryFile[] = []

	for (const file of files) {
		if (file.ignored) {
			continue
		}

		switch (file.parsed.form) {
			case 'special':
				specials.push(file)
				break
			case 'extra':
				others.push(file)
				break
			default:
				main.push(file)
		}
	}

	const byOrder = (a: LibraryFile, b: LibraryFile): number => {
		const left = order(a) ?? Number.POSITIVE_INFINITY
		const right = order(b) ?? Number.POSITIVE_INFINITY

		if (left !== right) {
			return left - right
		}

		return a.rel_path.localeCompare(b.rel_path)
	}

	main.sort(byOrder)
	specials.sort(byOrder)
	others.sort(byOrder)

	const seen = new Set<number | null>()
	const toWatch = main.filter(file => {
		if (file.missing || isWatched(file, progress, order)) {
			return false
		}

		const number = order(file)
		if (seen.has(number)) {
			return false
		}
		seen.add(number)

		return true
	})

	return { main, specials, others, toWatch }
}

export interface EpisodeIndex {
	seasonal: boolean
	list: MediaEpisode[]
	byKey: Map<string, MediaEpisode>
	position: Map<string, number>
}

function key(season: number | null | undefined, number: number): string {
	return `${season ?? ''}:${number}`
}

export function indexEpisodes(episodes: MediaEpisode[]): EpisodeIndex {
	const seasonal = episodes.some(episode => episode.season != null)
	const byKey = new Map<string, MediaEpisode>()
	const position = new Map<string, number>()

	episodes.forEach((episode, index) => {
		const at = key(seasonal ? episode.season : null, episode.number)
		byKey.set(at, episode)
		position.set(at, index + 1)
	})

	return { seasonal, list: episodes, byKey, position }
}

function fileKey(index: EpisodeIndex, file: LibraryFile): string | null {
	const number = episodeNumber(file)
	if (number === null) {
		return null
	}

	return key(index.seasonal ? (episodeSeason(file) ?? 1) : null, number)
}

export function episodeFor(index: EpisodeIndex, file: LibraryFile): MediaEpisode | undefined {
	const at = fileKey(index, file)

	return at === null ? undefined : index.byKey.get(at)
}

export function episodeOrder(index: EpisodeIndex): EpisodeOrder {
	if (!index.seasonal) {
		return episodeNumber
	}

	return file => {
		const at = fileKey(index, file)
		if (at === null) {
			return null
		}

		const known = index.position.get(at)
		if (known !== undefined) {
			return known
		}

		return ((episodeSeason(file) ?? 1) + 1) * 100_000 + (episodeNumber(file) ?? 0)
	}
}
