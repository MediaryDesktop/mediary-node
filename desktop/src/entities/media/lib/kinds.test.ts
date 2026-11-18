import { describe, expect, it } from 'vitest'

import { isReadMedia, isSeasonalRef, isVideoMedia } from './kinds'

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

	it('knows a series numbered by season by its reference', () => {
		expect(isSeasonalRef('tmdb:tv:1399')).toBe(true)
		expect(isSeasonalRef('tmdb:movie:1399')).toBe(false)
		expect(isSeasonalRef('anilist:1')).toBe(false)
	})
})
