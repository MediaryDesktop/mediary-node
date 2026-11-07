import type { MangaDownload } from '@entities/manga-source'
import { isChapterRead, LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow } from '@entities/reader'
import type { TrackerEntryPatch } from '@entities/tracker'

export function presentSources(rows: ChapterRow[]): Map<string, string> {
	const present = new Map<string, string>()

	for (const row of rows) {
		for (const option of row.options) {
			present.set(option.source, option.sourceName)
		}
	}

	return present
}

export function sourceCounts(rows: ChapterRow[]): Map<string, number> {
	const counts = new Map<string, number>()

	for (const row of rows) {
		for (const source of new Set(row.options.map(option => option.source))) {
			counts.set(source, (counts.get(source) ?? 0) + 1)
		}
	}

	return counts
}

export type StatusFilter = 'all' | 'saved' | 'read' | 'unread'

export const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'saved', 'read', 'unread']

export function isSaved(row: ChapterRow): boolean {
	return row.options.some(option => option.source === LOCAL_SOURCE)
}

export function matchesStatus(row: ChapterRow, filter: StatusFilter, progress: number): boolean {
	switch (filter) {
		case 'saved':
			return isSaved(row)
		case 'read':
			return isChapterRead(row.number, progress)
		case 'unread':
			return !isChapterRead(row.number, progress)
		default:
			return true
	}
}

export function readProgress(number: string | null, read: boolean, progress: number): number | null {
	if (number === null || !/^\d+$/.test(number)) {
		return null
	}

	const value = Number(number)
	if (value <= 0) {
		return null
	}

	const next = read ? Math.max(progress, value) : Math.min(progress, value - 1)

	return next === progress ? null : next
}

// What marking a chapter read or unread writes to the tracker. A title not on
// any list yet is put on "reading" with it: marking a chapter is starting it.
export function readProgressPatch(
	number: string | null,
	read: boolean,
	{ progress, listed }: { progress: number; listed: boolean }
): TrackerEntryPatch | null {
	const next = readProgress(number, read, progress)

	if (next === null) {
		return null
	}

	return listed ? { progress: next } : { status: 'CURRENT', progress: next }
}

export function matchesSearch(row: ChapterRow, query: string): boolean {
	const wanted = query.trim().toLowerCase()
	if (!wanted) {
		return true
	}
	if (row.number !== null && row.number.toLowerCase() === wanted.replace(/^#/, '')) {
		return true
	}

	return row.options.some(option => option.title.toLowerCase().includes(wanted))
}

export type SortOrder = 'newest' | 'oldest'

export function sortRows(rows: ChapterRow[], order: SortOrder): ChapterRow[] {
	if (order === 'oldest') {
		return rows
	}

	const numbered = rows.filter(row => row.number !== null)
	const rest = rows.filter(row => row.number === null)

	return [...numbered.reverse(), ...rest]
}

export type ChapterState =
	| { kind: 'saving'; done: number; total: number }
	| { kind: 'queued' }
	| { kind: 'read' }
	| { kind: 'saved' }
	| { kind: 'online' }

export function chapterState(
	row: ChapterRow,
	download: MangaDownload | undefined,
	progress: number
): ChapterState {
	if (download?.state === 'running') {
		return { kind: 'saving', done: download.pages_done, total: download.pages_total }
	}
	if (download?.state === 'queued') {
		return { kind: 'queued' }
	}
	if (isChapterRead(row.number, progress)) {
		return { kind: 'read' }
	}
	if (isSaved(row)) {
		return { kind: 'saved' }
	}

	return { kind: 'online' }
}

export const PAGE_SIZE = 50

export function pageCount(total: number, size = PAGE_SIZE): number {
	return Math.max(1, Math.ceil(total / size))
}

export function pageOf<T>(items: T[], page: number, size = PAGE_SIZE): T[] {
	const last = pageCount(items.length, size)
	const at = Math.min(Math.max(page, 1), last)

	return items.slice((at - 1) * size, at * size)
}

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

const SAVABLE = ['opds:', 'plugin:']

export function savableOption(row: ChapterRow, downloads: Map<string, MangaDownload>): ChapterOption | null {
	if (row.options.some(option => option.source === LOCAL_SOURCE)) {
		return null
	}

	const online = row.options.find(option => SAVABLE.some(prefix => option.source.startsWith(prefix)))
	const pending = activeDownload(row, downloads) !== undefined

	return online && !pending ? online : null
}
