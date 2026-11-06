import { fileNumber, isIgnored, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryContent, LibraryFile, LibraryRoot } from '@entities/library-item'

export interface UnmatchedGroup {
	key: string
	folder: string
	files: LibraryFile[]

	typedId: boolean
}

function matchesOnAniList(file: LibraryFile, content: LibraryContent | undefined): boolean {
	if (file.kind === 'manga') {
		return true
	}

	return (
		file.kind === 'video' &&
		content !== undefined &&
		content !== 'movies_and_shows' &&
		content !== 'doramas' &&
		content !== 'mixed'
	)
}

export function isUnmatched(file: LibraryFile): boolean {
	return !isMatched(file) && !isIgnored(file) && isTrackable(file)
}

function folderOf(file: LibraryFile): string {
	const cut = Math.max(file.path.lastIndexOf('\\'), file.path.lastIndexOf('/'))

	return cut > 0 ? file.path.slice(0, cut) : file.path
}

export function unmatchedGroups(files: LibraryFile[], roots: LibraryRoot[]): UnmatchedGroup[] {
	const contentOf = new Map(roots.map(root => [root.id, root.content]))
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
			files: list.sort((left, right) => (fileNumber(left) ?? 0) - (fileNumber(right) ?? 0)),
			typedId: list.every(file => matchesOnAniList(file, contentOf.get(file.root_id)))
		}))
		.sort((left, right) => left.folder.localeCompare(right.folder))
}
