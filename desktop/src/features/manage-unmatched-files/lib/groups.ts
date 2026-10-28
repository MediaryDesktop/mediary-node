import { fileNumber, isIgnored, isMatched, isTrackable } from '@entities/library-item'
import type { LibraryContent, LibraryFile, LibraryRoot } from '@entities/library-item'
import type { ManualMediaType } from '@entities/media'

export interface UnmatchedGroup {
	key: string
	folder: string
	files: LibraryFile[]

	// Only an AniList id is something people know by heart; TMDB needs movie or
	// show on top of the number, and book ids are opaque strings from two sources.
	typedId: boolean

	// What a title made by hand for the folder most likely is, as a starting point
	// for the user to correct.
	mediaType: ManualMediaType
	title: string
}

// The folder's kind of library says most of it; a single video without an episode
// number in a folder of movies and shows is a movie.
function guessMediaType(files: LibraryFile[], content: LibraryContent | undefined): ManualMediaType {
	const first = files[0]

	if (first?.kind === 'book') {
		return 'book'
	}

	if (first?.kind === 'manga') {
		return 'manga'
	}

	if (content === 'anime') {
		return 'anime'
	}

	if (content === 'doramas') {
		return 'dorama'
	}

	return files.length === 1 && first?.parsed.episode == null ? 'movie' : 'series'
}

// Mirrors the node's choice of source: comics go to AniList anywhere, videos
// only under an anime folder. An unknown root is not assumed to be anime.
function matchesOnAniList(file: LibraryFile, content: LibraryContent | undefined): boolean {
	if (file.kind === 'manga') {
		return true
	}

	return (
		file.kind === 'video' &&
		content !== undefined &&
		content !== 'movies_and_shows' &&
		content !== 'doramas'
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
		.map(([folder, list]) => {
			const files = list.sort((left, right) => (fileNumber(left) ?? 0) - (fileNumber(right) ?? 0))
			const content = contentOf.get(files[0]?.root_id ?? -1)

			return {
				key: folder,
				folder,
				files,
				typedId: files.every(file => matchesOnAniList(file, contentOf.get(file.root_id))),
				mediaType: guessMediaType(files, content),
				title: files.find(file => file.parsed.title)?.parsed.title ?? ''
			}
		})
		.sort((left, right) => left.folder.localeCompare(right.folder))
}
