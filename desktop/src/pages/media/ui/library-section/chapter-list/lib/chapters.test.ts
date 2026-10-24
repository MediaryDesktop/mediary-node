import { describe, expect, it } from 'vitest'

import type { MangaDownload } from '@entities/manga-source'
import type { ChapterOption, ChapterRow } from '@entities/reader'

import {
	activeDownload,
	chapterState,
	latestDownloads,
	matchesSearch,
	matchesStatus,
	pageCount,
	pageOf,
	presentSources,
	savableOption,
	sortRows,
	sourceCounts
} from './chapters'

function option(ref: string, source: string, sourceName = source, title = 'Chapter 1'): ChapterOption {
	return { ref, number: '1', title, source, sourceName, detail: '' }
}

function row(...options: ChapterOption[]): ChapterRow {
	return { key: '1', number: '1', options }
}

function numbered(number: string | null, ...options: ChapterOption[]): ChapterRow {
	return { key: number ?? 'x', number, options }
}

function download(chapterRef: string, state: string): MangaDownload {
	return { chapter_ref: chapterRef, state } as MangaDownload
}

describe('chapter list helpers', () => {
	it('lists each source once, with its name', () => {
		const rows = [
			row(option('a', 'local', 'Library')),
			row(option('b', 'opds:1', 'Kavita'), option('c', 'local', 'Library'))
		]

		expect([...presentSources(rows)]).toEqual([
			['local', 'Library'],
			['opds:1', 'Kavita']
		])
	})

	it('keeps the newest download of each chapter', () => {
		const downloads = latestDownloads([download('a', 'running'), download('a', 'failed')])

		expect(downloads.get('a')?.state).toBe('running')
	})

	it('saves a chapter from its server copy unless the library has it or it is under way', () => {
		const online = option('b', 'opds:1')

		expect(savableOption(row(online), new Map())).toBe(online)
		expect(savableOption(row(option('a', 'local'), online), new Map())).toBeNull()

		const running = latestDownloads([download('b', 'queued')])

		expect(savableOption(row(online), running)).toBeNull()
		expect(activeDownload(row(online), running)?.state).toBe('queued')
	})

	it('counts the chapters of each source, a chapter once per source', () => {
		const rows = [
			numbered('1', option('a', 'local'), option('b', 'plugin:mangalib')),
			numbered('2', option('c', 'plugin:mangalib'), option('d', 'plugin:mangalib'))
		]

		expect(Object.fromEntries(sourceCounts(rows))).toEqual({ local: 1, 'plugin:mangalib': 2 })
	})

	it('filters by what the user has of a chapter', () => {
		const saved = numbered('3', option('a', 'local'))
		const online = numbered('12', option('b', 'opds:1'))

		expect(matchesStatus(saved, 'saved', 0)).toBe(true)
		expect(matchesStatus(online, 'saved', 0)).toBe(false)
		expect(matchesStatus(saved, 'read', 5)).toBe(true)
		expect(matchesStatus(online, 'read', 5)).toBe(false)
		expect(matchesStatus(online, 'unread', 5)).toBe(true)
		expect(matchesStatus(online, 'all', 5)).toBe(true)
	})

	it("finds a chapter by its number or a copy's title", () => {
		const twelve = numbered('12', option('a', 'local', 'Library', 'The End of the Adventure'))

		expect(matchesSearch(twelve, '12')).toBe(true)
		expect(matchesSearch(twelve, '#12')).toBe(true)
		expect(matchesSearch(twelve, '1')).toBe(false)
		expect(matchesSearch(twelve, 'adventure')).toBe(true)
		expect(matchesSearch(twelve, '  ')).toBe(true)
	})

	it('sorts newest first, keeping unnumbered chapters last', () => {
		const rows = [numbered('1'), numbered('2'), numbered('3'), numbered(null)]

		expect(sortRows(rows, 'newest').map(r => r.number)).toEqual(['3', '2', '1', null])
		expect(sortRows(rows, 'oldest').map(r => r.number)).toEqual(['1', '2', '3', null])
		expect(rows.map(r => r.number)).toEqual(['1', '2', '3', null])
	})

	it('says a save under way first, then read, then saved', () => {
		const saved = numbered('3', option('a', 'local'))
		const running = {
			chapter_ref: 'a',
			state: 'running',
			pages_done: 4,
			pages_total: 20
		} as MangaDownload

		expect(chapterState(saved, running, 10)).toEqual({ kind: 'saving', done: 4, total: 20 })
		expect(chapterState(saved, download('a', 'queued'), 10)).toEqual({ kind: 'queued' })
		expect(chapterState(saved, undefined, 10)).toEqual({ kind: 'read' })
		expect(chapterState(saved, undefined, 0)).toEqual({ kind: 'saved' })
		expect(chapterState(numbered('3', option('b', 'opds:1')), undefined, 0)).toEqual({ kind: 'online' })
	})

	it('pages a long list, holding a page past the end to the last', () => {
		const items = Array.from({ length: 120 }, (_, i) => i)

		expect(pageCount(120, 50)).toBe(3)
		expect(pageCount(0, 50)).toBe(1)
		expect(pageOf(items, 3, 50)).toEqual(items.slice(100))
		expect(pageOf(items, 9, 50)).toEqual(items.slice(100))
		expect(pageOf(items, 0, 50)).toEqual(items.slice(0, 50))
	})

	it("saves a manga plugin's chapter, never a MangaDex one", () => {
		const plugin = option('p', 'plugin:comics')
		const dex = option('d', 'mangadex')

		expect(savableOption(row(dex, plugin), new Map())).toBe(plugin)
		expect(savableOption(row(dex), new Map())).toBeNull()
	})
})
