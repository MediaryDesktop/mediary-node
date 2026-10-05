import { describe, expect, it } from 'vitest'

import {
	chapterNumberFromName,
	filterChapters,
	isChapterRead,
	mergeChapters,
	neighbourChapters
} from './chapters'
import type { ChapterOption } from './chapters'

const option = (ref: string, number: string | null, source: string): ChapterOption => ({
	ref,
	number,
	title: ref,
	source,
	sourceName: source,
	detail: ''
})

const options = [
	option('opds:1:a', '13', 'opds:1'),
	option('opds:1:b', '12', 'opds:1'),
	option('local:5', '12', 'local'),
	option('opds:1:c', '12.5', 'opds:1'),
	option('local:9', null, 'local'),
	option('opds:1:d', '013', 'opds:1')
]

describe('mergeChapters', () => {
	const rows = mergeChapters(options)

	it('makes one row per number, in number order, unnumbered last', () => {
		expect(rows.map(row => row.number)).toEqual(['12', '12.5', '13', null])
	})

	it('opens the library copy first and offers the server copy', () => {
		expect(rows[0]?.options.map(item => item.ref)).toEqual(['local:5', 'opds:1:b'])
	})

	it('treats 013 and 13 as the same chapter', () => {
		expect(rows[2]?.options.map(item => item.ref)).toEqual(['opds:1:a', 'opds:1:d'])
	})
})

describe('filterChapters', () => {
	it('keeps one source and drops rows without it', () => {
		const local = filterChapters(mergeChapters(options), 'local')

		expect(local.map(row => row.options.map(item => item.ref))).toEqual([['local:5'], ['local:9']])
	})
})

describe('neighbourChapters', () => {
	const rows = mergeChapters(options)

	it('crosses sources: after a local 12 comes 12.5 from the server', () => {
		expect(neighbourChapters(rows, 'local:5')).toEqual({ previous: null, next: options[3] })
	})

	it('finds the row of a copy that is not the first one', () => {
		expect(neighbourChapters(rows, 'opds:1:d').previous?.ref).toBe('opds:1:c')
	})

	it('offers no neighbours to an unnumbered chapter', () => {
		expect(neighbourChapters(rows, 'local:9')).toEqual({ previous: null, next: null })
	})
})

describe('isChapterRead', () => {
	it('is read up to the progress, extras included', () => {
		expect(isChapterRead('12', 12)).toBe(true)
		expect(isChapterRead('12.5', 12)).toBe(false)
		expect(isChapterRead('12.5', 13)).toBe(true)
		expect(isChapterRead(null, 40)).toBe(false)
	})
})

describe('chapterNumberFromName', () => {
	it('reads the number the node wrote into a saved chapter', () => {
		expect(chapterNumberFromName('Berserk/Berserk - Ch. 013.5.cbz')).toBe('13.5')
		expect(chapterNumberFromName('Berserk/Berserk - Ch. 013.cbz')).toBe('13')
		expect(chapterNumberFromName('Vol. 2 Ch. 7.cbz')).toBe('7')
		expect(chapterNumberFromName('Berserk 014.cbz')).toBe('14')
	})

	it('finds nothing in a name without a number', () => {
		expect(chapterNumberFromName('Berserk/Berserk - Prototype.cbz')).toBeNull()
	})
})
