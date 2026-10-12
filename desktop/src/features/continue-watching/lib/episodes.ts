import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

export interface TitleEpisodes {
	main: LibraryFile[]
	specials: LibraryFile[]
	others: LibraryFile[]

	// Main episodes past the user's progress, one file per number: two releases of
	// episode 5 are one episode left to watch, not two.
	toWatch: LibraryFile[]
}

// Where a file stands in the title's order, which is what progress counts. For an
// anime that is its episode number; a show numbered by season counts across them.
export type EpisodeOrder = (file: LibraryFile) => number | null

// The match is what the user or the matcher settled on, so it wins over the name.
export function episodeNumber(file: LibraryFile): number | null {
	return file.match?.episode ?? file.parsed.episode ?? null
}

export function episodeSeason(file: LibraryFile): number | null {
	return file.match?.season ?? file.parsed.season ?? null
}

// A movie has no number, so it counts as watched once anything at all is.
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

// What the sources say about a title's episodes, indexed for the files to find
// their own. A show listed by season is keyed by season and number; an anime, by
// number alone.
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

	// A first season is often left unwritten on the file: Show - 05.mkv.
	return key(index.seasonal ? (episodeSeason(file) ?? 1) : null, number)
}

export function episodeFor(index: EpisodeIndex, file: LibraryFile): MediaEpisode | undefined {
	const at = fileKey(index, file)

	return at === null ? undefined : index.byKey.get(at)
}

// The order progress counts in. A show's episode the list does not hold yet sorts
// after every known one, by season, and is never taken for watched.
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
