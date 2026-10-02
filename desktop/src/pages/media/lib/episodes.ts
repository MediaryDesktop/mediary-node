import type { LibraryFile } from '@entities/library-item'

export interface TitleEpisodes {
	main: LibraryFile[]
	specials: LibraryFile[]
	others: LibraryFile[]

	// Main episodes past the user's progress, one file per number: two releases of
	// episode 5 are one episode left to watch, not two.
	toWatch: LibraryFile[]
}

// The match is what the user or the matcher settled on, so it wins over the name.
export function episodeNumber(file: LibraryFile): number | null {
	return file.match?.episode ?? file.parsed.episode ?? null
}

// A movie has no number, so it counts as watched once anything at all is.
export function isWatched(file: LibraryFile, progress: number): boolean {
	const number = episodeNumber(file)

	return number === null ? progress > 0 : number <= progress
}

function byEpisode(a: LibraryFile, b: LibraryFile): number {
	const left = episodeNumber(a) ?? Number.POSITIVE_INFINITY
	const right = episodeNumber(b) ?? Number.POSITIVE_INFINITY

	if (left !== right) {
		return left - right
	}

	return a.rel_path.localeCompare(b.rel_path)
}

export function groupTitleFiles(files: LibraryFile[], progress: number): TitleEpisodes {
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

	main.sort(byEpisode)
	specials.sort(byEpisode)
	others.sort(byEpisode)

	const seen = new Set<number | null>()
	const toWatch = main.filter(file => {
		if (file.missing || isWatched(file, progress)) {
			return false
		}

		const number = episodeNumber(file)
		if (seen.has(number)) {
			return false
		}
		seen.add(number)

		return true
	})

	return { main, specials, others, toWatch }
}
