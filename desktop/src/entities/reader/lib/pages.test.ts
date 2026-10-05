import { describe, expect, it } from 'vitest'

import { clampPage, isLastPage, neighbourChapters, prefetchIndexes } from './pages'

describe('clampPage', () => {
	it('keeps the page inside the chapter', () => {
		expect(clampPage(-3, 10)).toBe(0)
		expect(clampPage(42, 10)).toBe(9)
		expect(clampPage(4, 10)).toBe(4)
	})

	it('sits on the first page of an empty chapter', () => {
		expect(clampPage(5, 0)).toBe(0)
	})
})

describe('isLastPage', () => {
	it('is the final page and nothing before it', () => {
		expect(isLastPage(19, 20)).toBe(true)
		expect(isLastPage(18, 20)).toBe(false)
		expect(isLastPage(0, 0)).toBe(false)
	})
})

describe('prefetchIndexes', () => {
	it('fetches the next pages and no further', () => {
		expect(prefetchIndexes(3, 10)).toEqual([4, 5])
	})

	it('stops at the end of the chapter', () => {
		expect(prefetchIndexes(8, 10)).toEqual([9])
		expect(prefetchIndexes(9, 10)).toEqual([])
	})
})

describe('neighbourChapters', () => {
	const chapters = [
		{ ref: 'local:3', chapter: 3 },
		{ ref: 'local:1', chapter: 1 },
		{ ref: 'local:9', chapter: null },
		{ ref: 'local:2', chapter: 2 }
	]

	it('finds the chapters either side in number order', () => {
		expect(neighbourChapters(chapters, 'local:2')).toEqual({
			previous: { ref: 'local:1', chapter: 1 },
			next: { ref: 'local:3', chapter: 3 }
		})
	})

	it('has no neighbour past either end', () => {
		expect(neighbourChapters(chapters, 'local:1').previous).toBeNull()
		expect(neighbourChapters(chapters, 'local:3').next).toBeNull()
	})

	it('offers nothing for an unnumbered chapter', () => {
		expect(neighbourChapters(chapters, 'local:9')).toEqual({ previous: null, next: null })
	})
})
