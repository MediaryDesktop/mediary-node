import { fileName, fileTitle } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import type { MangaChapter } from '@entities/manga-source'
import { chapterNumberFromName, LOCAL_SOURCE, localRef, mergeChapters } from '@entities/reader'
import type { ChapterOption, ChapterRow } from '@entities/reader'

export interface ChapterLabels {
	library: string
	external: string
	pages: (count: number) => string
}

// A library file is a chapter of the title only when it is matched to it and is
// a chapter at all — not ignored, missing, or a special or extra.
function isChapterFile(file: LibraryFile, mediaRef: string): boolean {
	return (
		file.match?.media_ref === mediaRef &&
		!file.ignored &&
		!file.missing &&
		file.parsed.form !== 'special' &&
		file.parsed.form !== 'extra'
	)
}

function fromFile(file: LibraryFile, labels: ChapterLabels): ChapterOption {
	const counted = file.match?.episode ?? file.parsed.episode

	return {
		ref: localRef(file.id),
		number:
			counted === undefined || counted === null
				? chapterNumberFromName(file.rel_path)
				: String(counted),
		title: fileTitle(file),
		source: LOCAL_SOURCE,
		sourceName: labels.library,
		detail: fileName(file)
	}
}

function fromSource(chapter: MangaChapter, labels: ChapterLabels): ChapterOption {
	const credit = [chapter.language?.toUpperCase(), ...(chapter.groups ?? [])].filter(Boolean).join(' · ')
	const size = chapter.external_url ? labels.external : chapter.pages > 0 ? labels.pages(chapter.pages) : ''

	return {
		ref: chapter.ref,
		number: chapter.number ?? null,
		title: chapter.title,
		source: chapter.source,
		sourceName: chapter.source_name,
		detail: [credit, size].filter(Boolean).join(' · '),
		language: chapter.language,
		groups: chapter.groups ?? undefined,
		pages: chapter.pages,
		externalUrl: chapter.external_url
	}
}

// Every chapter of a title, from the library and from the sources it is linked
// to, merged into one row per chapter number.
export function titleChapterRows(
	mediaRef: string | undefined,
	files: LibraryFile[],
	online: MangaChapter[],
	labels: ChapterLabels
): ChapterRow[] {
	const local = mediaRef ? files.filter(file => isChapterFile(file, mediaRef)) : []

	return mergeChapters([
		...local.map(file => fromFile(file, labels)),
		...online.map(chapter => fromSource(chapter, labels))
	])
}
