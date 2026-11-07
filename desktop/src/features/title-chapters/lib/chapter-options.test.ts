import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '@entities/library-item'
import type { MangaChapter } from '@entities/manga-source'

import { titleChapterRows } from './chapter-options'

const REF = 'anilist:30013'

function file(id: number, overrides: Partial<LibraryFile> = {}): LibraryFile {
	return {
		id,
		root_id: 1,
		path: `D:/Manga/Berserk/Berserk ${id}.cbz`,
		rel_path: `Berserk/Berserk ${id}.cbz`,
		kind: 'book',
		size_bytes: 10,
		modified_at: '2026-01-01T00:00:00Z',
		missing: false,
		ignored: false,
		parsed: { form: 'manga', title: 'Berserk', episode: id },
		match: { media_ref: REF, source: 'auto' },
		...overrides
	} as LibraryFile
}

function chapter(number: string, overrides: Partial<MangaChapter> = {}): MangaChapter {
	return {
		ref: `mangadex:${number}`,
		number,
		title: `Chapter ${number}`,
		source: 'mangadex',
		source_name: 'MangaDex',
		pages: 20,
		language: 'en',
		groups: ['Band'],
		...overrides
	} as MangaChapter
}

const labels = { library: 'Library', external: 'Opens elsewhere', pages: (count: number) => `${count} pages` }

describe('titleChapterRows', () => {
	it('puts a chapter from the library and the same one online on one row', () => {
		const rows = titleChapterRows(REF, [file(1)], [chapter('1'), chapter('2')], labels)

		expect(rows.map(row => row.options.map(option => option.sourceName))).toEqual([
			['Library', 'MangaDex'],
			['MangaDex']
		])
	})

	it('keeps only files matched to this title that are chapters at all', () => {
		const files = [
			file(1),
			file(2, { match: { media_ref: 'anilist:1', source: 'auto' } as LibraryFile['match'] }),
			file(3, { ignored: true }),
			file(4, { missing: true }),
			file(5, { parsed: { form: 'extra' } })
		]

		expect(titleChapterRows(REF, files, [], labels).map(row => row.number)).toEqual(['1'])
	})

	it('describes an online chapter by its language, group and size', () => {
		const [row] = titleChapterRows(REF, [], [chapter('1')], labels)

		expect(row!.options[0]!.detail).toBe('EN · Band · 20 pages')
	})

	it('has no library chapters for no title', () => {
		expect(titleChapterRows(undefined, [file(1)], [], labels)).toEqual([])
	})
})
