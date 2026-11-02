import { fileNumber, isIgnored, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryContent, LibraryFile, LibraryRoot } from '@entities/library-item'

export interface UnmatchedGroup {
	key: string
	folder: string
	files: LibraryFile[]

	// Only an AniList id is something people know by heart; TMDB needs movie or
	// show on top of the number, and book ids are opaque strings from two sources.
	typedId: boolean
}

// Mirrors the node's choice of source: comics go to AniList anywhere, videos
// only under an anime folder. An unknown root is not assumed to be anime, and
// neither is a folder of mixed videos.
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
