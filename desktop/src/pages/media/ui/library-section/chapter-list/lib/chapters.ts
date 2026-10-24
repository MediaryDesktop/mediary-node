import type { MangaDownload } from '@entities/manga-source'
import { LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow } from '@entities/reader'

// Every source the list holds a chapter from, with its name.
export function presentSources(rows: ChapterRow[]): Map<string, string> {
	const present = new Map<string, string>()

	for (const row of rows) {
		for (const option of row.options) {
			present.set(option.source, option.sourceName)
		}
	}

	return present
}

// The newest download of each chapter, by the copy it was saved from. The node
// lists them newest first.
export function latestDownloads(items: MangaDownload[]): Map<string, MangaDownload> {
	const downloads = new Map<string, MangaDownload>()

	for (const item of items) {
		if (!downloads.has(item.chapter_ref)) {
			downloads.set(item.chapter_ref, item)
		}
	}

	return downloads
}

export function isActive(item: MangaDownload | undefined): boolean {
	return item?.state === 'queued' || item?.state === 'running'
}

export function activeDownload(
	row: ChapterRow,
	downloads: Map<string, MangaDownload>
): MangaDownload | undefined {
	for (const option of row.options) {
		const item = downloads.get(option.ref)
		if (isActive(item)) {
			return item
		}
	}

	return undefined
}

// A chapter the library does not hold can be saved from its first copy on the
// user's server or from a manga plugin, unless that is already under way.
// MangaDex says nothing of keeping its pages.
const SAVABLE = ['opds:', 'plugin:']

export function savableOption(row: ChapterRow, downloads: Map<string, MangaDownload>): ChapterOption | null {
	if (row.options.some(option => option.source === LOCAL_SOURCE)) {
		return null
	}

	const online = row.options.find(option => SAVABLE.some(prefix => option.source.startsWith(prefix)))
	const pending = activeDownload(row, downloads) !== undefined

	return online && !pending ? online : null
}
