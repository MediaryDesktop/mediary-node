import { describe, expect, it } from 'vitest'

import { pageItems } from './pageItems'

describe('pageItems', () => {
	it('lists every page of a short list', () => {
		expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5])
	})

	it('keeps the ends and the pages around the current one', () => {
		expect(pageItems(10, 21)).toEqual([1, 'gap', 9, 10, 11, 'gap', 21])
	})

	it('fills a gap of one page with the page itself', () => {
		expect(pageItems(4, 21)).toEqual([1, 2, 3, 4, 5, 'gap', 21])
	})

	it('shows the first pages near the start and the last near the end', () => {
		expect(pageItems(1, 21)).toEqual([1, 2, 3, 4, 'gap', 21])
		expect(pageItems(21, 21)).toEqual([1, 'gap', 18, 19, 20, 21])
	})
})
