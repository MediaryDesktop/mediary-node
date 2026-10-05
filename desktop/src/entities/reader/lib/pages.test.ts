import { describe, expect, it } from 'vitest'

import { clampPage, isLastPage, prefetchIndexes } from './pages'

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
