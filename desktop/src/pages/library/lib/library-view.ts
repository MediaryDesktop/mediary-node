import { fileNumber, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

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
}

// Files matched to the same title belong together; what the node could not name
// is grouped by the title read off the name, so a folder of one show still reads
// as one show.
function groupKey(file: LibraryFile): string {
	return file.match?.media_ref ?? `parsed:${file.parsed.title ?? file.rel_path}`
}

function groupTitle(file: LibraryFile, fallback: string): string {
	const title = file.parsed.title?.trim()

	return title && title !== '' ? title : fallback
}

export function groupFiles(files: LibraryFile[], fallback: string): FileGroup[] {
	const groups = new Map<string, FileGroup>()

	for (const file of files) {
		const key = groupKey(file)
		const group = groups.get(key)

		if (group) {
			group.files.push(file)

			continue
		}

		groups.set(key, { key, title: groupTitle(file, fallback), files: [file] })
	}

	for (const group of groups.values()) {
		group.files.sort((left, right) => {
			const byNumber = (fileNumber(left) ?? 0) - (fileNumber(right) ?? 0)

			return byNumber === 0 ? left.rel_path.localeCompare(right.rel_path) : byNumber
		})
	}

	return [...groups.values()].sort((left, right) => left.title.localeCompare(right.title))
}
