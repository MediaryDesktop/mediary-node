import { fileNumber, isIgnored, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

export interface UnmatchedGroup {
	key: string
	folder: string
	files: LibraryFile[]
}

// What still needs a title: not matched, not set aside, and not an opening or a
// trailer, which belong to no title by design.
export function isUnmatched(file: LibraryFile): boolean {
	return !isMatched(file) && !isIgnored(file) && isTrackable(file)
}

function folderOf(file: LibraryFile): string {
	const cut = Math.max(file.path.lastIndexOf('\\'), file.path.lastIndexOf('/'))

	return cut > 0 ? file.path.slice(0, cut) : file.path
}

// One page per folder: the files of one release almost always sit together, so a
// folder is the unit someone matches in one go.
export function unmatchedGroups(files: LibraryFile[]): UnmatchedGroup[] {
	const byFolder = new Map<string, LibraryFile[]>()

	for (const file of files) {
		if (!isUnmatched(file)) {
			continue
		}

		const folder = folderOf(file)
		byFolder.set(folder, [...(byFolder.get(folder) ?? []), file])
	}

	return [...byFolder.entries()]
		.map(([folder, list]) => ({
			key: folder,
			folder,
			files: list.sort((left, right) => (fileNumber(left) ?? 0) - (fileNumber(right) ?? 0))
		}))
		.sort((left, right) => left.folder.localeCompare(right.folder))
}
