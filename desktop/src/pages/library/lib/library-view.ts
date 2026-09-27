import { fileNumber, fileSeason, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryFile, LibraryTitle } from '@entities/library-item'

export type LibraryView = 'all' | 'unmatched' | 'missing'

export const LIBRARY_VIEWS: readonly LibraryView[] = ['all', 'unmatched', 'missing']

export function matchesView(file: LibraryFile, view: LibraryView): boolean {
	switch (view) {
		case 'unmatched':
			return !isMatched(file) && isTrackable(file)
		case 'missing':
			return file.missing
		default:
			return true
	}
}

export function matchesSearch(file: LibraryFile, needle: string): boolean {
	if (needle === '') {
		return true
	}

	const title = file.parsed.title?.toLowerCase() ?? ''

	return title.includes(needle) || file.rel_path.toLowerCase().includes(needle)
}

export function visibleFiles(files: LibraryFile[], view: LibraryView, search: string): LibraryFile[] {
	const needle = search.trim().toLowerCase()

	return files.filter(file => matchesView(file, view) && matchesSearch(file, needle))
}

export function unmatchedCount(files: LibraryFile[]): number {
	return files.filter(file => !isMatched(file) && isTrackable(file)).length
}

export interface FileGroup {
	key: string
	title: string
	files: LibraryFile[]

	// What the node knows about the title behind the group. Absent while the
	// group's files are unmatched, and absent for a matched title the node has
	// never fetched — the group still shows, without a poster.
	title_info?: LibraryTitle

	matched: boolean

	// Which seasons the group's files belong to, ascending and without repeats.
	// The numbers, not how many there are: a show whose files are all "s02e…" has
	// one season, and calling that "1 season" reads as season one.
	seasons: number[]
}

// Files matched to the same title belong together; what the node could not name
// is grouped by the title read off the name, so a folder of one show still reads
// as one show.
function groupKey(file: LibraryFile): string {
	return file.match?.media_ref ?? `parsed:${file.parsed.title ?? file.rel_path}`
}

function groupTitle(file: LibraryFile, titles: Map<string, LibraryTitle>, fallback: string): string {
	const described = file.match ? titles.get(file.match.media_ref)?.title.trim() : undefined
	if (described) {
		return described
	}

	const parsed = file.parsed.title?.trim()

	return parsed && parsed !== '' ? parsed : fallback
}

// For ordering only: a file whose name says nothing about seasons sorts with the
// first one rather than ahead of everything.
function sortSeason(file: LibraryFile): number {
	return fileSeason(file) ?? 1
}

export function titleIndex(titles: LibraryTitle[] | undefined): Map<string, LibraryTitle> {
	return new Map((titles ?? []).map(title => [title.media_ref, title]))
}

export function groupFiles(
	files: LibraryFile[],
	titles: Map<string, LibraryTitle>,
	fallback: string
): FileGroup[] {
	const groups = new Map<string, FileGroup>()
	const seasons = new Map<string, Set<number>>()

	for (const file of files) {
		const key = groupKey(file)
		const group = groups.get(key)

		const season = fileSeason(file)

		if (season !== null) {
			seasons.set(key, (seasons.get(key) ?? new Set()).add(season))
		}

		if (group) {
			group.files.push(file)
			group.matched &&= isMatched(file)

			continue
		}

		groups.set(key, {
			key,
			title: groupTitle(file, titles, fallback),
			files: [file],
			title_info: file.match ? titles.get(file.match.media_ref) : undefined,
			matched: isMatched(file),
			seasons: []
		})
	}

	for (const [key, group] of groups) {
		group.seasons = [...(seasons.get(key) ?? [])].sort((left, right) => left - right)

		group.files.sort((left, right) => {
			const bySeason = sortSeason(left) - sortSeason(right)
			if (bySeason !== 0) {
				return bySeason
			}

			const byNumber = (fileNumber(left) ?? 0) - (fileNumber(right) ?? 0)

			return byNumber === 0 ? left.rel_path.localeCompare(right.rel_path) : byNumber
		})
	}

	return [...groups.values()].sort((left, right) => left.title.localeCompare(right.title))
}
