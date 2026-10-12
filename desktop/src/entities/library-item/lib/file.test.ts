import { describe, expect, it } from 'vitest'

import type { LibraryFile } from '../api/api'

import { fileName, fileNumber, fileSeason, fileTitle, isMatched } from './file'

function file(overrides: Partial<LibraryFile> = {}): LibraryFile {
	return {
		id: 1,
		root_id: 1,
		path: 'D:/Anime/Frieren/Season 2/s02e01.mkv',
		rel_path: 'Frieren/Season 2/s02e01.mkv',
		kind: 'video',
		size_bytes: 10,
		modified_at: '2026-01-01T00:00:00Z',
		missing: false,
		ignored: false,
		parsed: { form: 'series', title: 'Frieren', season: 2, episode: 1 },
		...overrides
	}
}

describe('library file helpers', () => {
	it('names a file by its own name, not its folders', () => {
		expect(fileName(file())).toBe('s02e01.mkv')
	})

	it('falls back to the path when the name gave no title', () => {
		expect(fileTitle(file({ parsed: { form: 'series', title: '  ' } }))).toBe(
			'Frieren/Season 2/s02e01.mkv'
		)
	})

	it('reads the number as an episode or a chapter', () => {
		expect(fileNumber(file())).toBe(1)
		expect(fileNumber(file({ parsed: { form: 'series', chapter: 12 } }))).toBe(12)
	})

	it('prefers the season the match settled on over the one in the name', () => {
		const matched = file({
			match: { media_ref: 'anilist:1', confidence: 1, source: 'manual', season: 3 }
		})

		expect(fileSeason(matched)).toBe(3)
		expect(fileSeason(file())).toBe(2)
		expect(isMatched(matched)).toBe(true)
		expect(isMatched(file())).toBe(false)
	})
})
