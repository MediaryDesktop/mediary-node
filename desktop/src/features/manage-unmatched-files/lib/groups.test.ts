import { describe, expect, it } from 'vitest'

import type { LibraryContent, LibraryFile, LibraryRoot } from '@entities/library-item'

import { unmatchedGroups } from './groups'

let nextId = 1

function root(id: number, content: LibraryContent): LibraryRoot {
	return {
		id,
		content,
		path: `D:\\${content}`,
		added_at: '2026-01-01T00:00:00Z',
		file_count: 0
	} as LibraryRoot
}

const ROOTS = [root(1, 'anime'), root(2, 'movies_and_shows'), root(3, 'books'), root(4, 'mixed')]

function file(path: string, overrides: Partial<LibraryFile> = {}): LibraryFile {
	return {
		id: nextId++,
		root_id: 1,
		path,
		rel_path: path,
		kind: 'video',
		size_bytes: 10,
		modified_at: '2026-01-01T00:00:00Z',
		missing: false,
		ignored: false,
		parsed: { form: 'series', title: 'Show' },
		...overrides
	}
}

describe('unmatchedGroups', () => {
	it('puts the files of one folder on one page, in episode order', () => {
		const groups = unmatchedGroups(
			[
				file('D:\\Anime\\Show\\ep 10.mkv', { parsed: { form: 'series', episode: 10 } }),
				file('D:\\Anime\\Show\\ep 2.mkv', { parsed: { form: 'series', episode: 2 } }),
				file('D:\\Anime\\Other\\ep 1.mkv')
			],
			ROOTS
		)

		expect(groups.map(group => group.folder)).toEqual(['D:\\Anime\\Other', 'D:\\Anime\\Show'])
		expect(groups[1]?.files.map(entry => entry.parsed.episode)).toEqual([2, 10])
	})

	// Matched, set aside, or an opening: none of these is asking for a title.
	it('leaves out everything that is not waiting for a title', () => {
		const groups = unmatchedGroups(
			[
				file('D:\\A\\matched.mkv', {
					match: { media_ref: 'anilist:1', confidence: 1, source: 'manual' }
				}),
				file('D:\\A\\ignored.mkv', { ignored: true }),
				file('D:\\A\\ncop.mkv', { parsed: { form: 'extra' } }),
				file('D:\\A\\waiting.mkv')
			],
			ROOTS
		)

		expect(groups).toHaveLength(1)
		expect(groups[0]?.files.map(entry => entry.path)).toEqual(['D:\\A\\waiting.mkv'])
	})

	it('offers a typed id only where every file is matched on AniList', () => {
		const typed = (files: LibraryFile[], roots = ROOTS) => unmatchedGroups(files, roots)[0]?.typedId

		expect(typed([file('D:\\Anime\\Show\\ep 1.mkv')])).toBe(true)
		expect(typed([file('D:\\Anime\\Manga\\ch 1.cbz', { kind: 'manga', root_id: 3 })])).toBe(true)
		expect(typed([file('D:\\Movies\\Film.mkv', { root_id: 2 })])).toBe(false)
		expect(typed([file('D:\\Downloads\\Film.mkv', { root_id: 4 })])).toBe(false)
		expect(typed([file('D:\\Books\\Book.epub', { kind: 'book', root_id: 3 })])).toBe(false)
		expect(
			typed([file('D:\\Anime\\Mix\\ep 1.mkv'), file('D:\\Anime\\Mix\\novel.epub', { kind: 'book' })])
		).toBe(false)
		expect(typed([file('D:\\Anime\\Show\\ep 1.mkv')], [])).toBe(false)
	})
})
