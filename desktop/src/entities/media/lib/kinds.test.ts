import { describe, expect, it } from 'vitest'

import { isReadMedia, isVideoMedia } from './kinds'

describe('media kinds', () => {
	it('tells watched titles from read ones', () => {
		expect(['anime', 'movie', 'series', 'dorama'].every(isVideoMedia)).toBe(true)
		expect(['manga', 'book'].some(isVideoMedia)).toBe(false)
		expect(['manga', 'book'].every(isReadMedia)).toBe(true)
		expect(['anime', 'movie'].some(isReadMedia)).toBe(false)
	})

	it('counts a type it does not know as neither', () => {
		expect(isVideoMedia('podcast')).toBe(false)
		expect(isReadMedia('podcast')).toBe(false)
	})
})
