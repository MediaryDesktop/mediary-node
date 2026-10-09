import { describe, expect, it } from 'vitest'

import { discoverSections, isDiscoverTab, previousSeason, seasonOf } from './sections'

describe('discover sections', () => {
	it('reads the season off the calendar', () => {
		expect(seasonOf(new Date(2026, 0, 15))).toEqual({ season: 'WINTER', year: 2026 })
		expect(seasonOf(new Date(2026, 9, 9))).toEqual({ season: 'FALL', year: 2026 })
	})

	it('steps back across the new year', () => {
		expect(previousSeason({ season: 'WINTER', year: 2026 })).toEqual({ season: 'FALL', year: 2025 })
		expect(previousSeason({ season: 'FALL', year: 2026 })).toEqual({ season: 'SUMMER', year: 2026 })
	})

	it('asks each source for its own kind of media', () => {
		const anime = discoverSections('anime', new Date(2026, 9, 9))

		expect(anime.map(section => section.id)).toEqual([
			'trending',
			'thisSeason',
			'lastSeason',
			'upcoming',
			'movies'
		])
		expect(anime[1]?.query).toMatchObject({ type: 'anime', season: 'FALL', year: 2026 })
		expect(anime[2]?.key).toBe('anime:lastSeason:SUMMER-2026')

		expect(discoverSections('manga', new Date()).map(section => section.query.country)).toEqual([
			'JP',
			'KR',
			'CN',
			undefined
		])

		for (const section of discoverSections('book', new Date())) {
			expect(section.query.type).toBe('book')
		}
	})

	it('knows its tabs', () => {
		expect(isDiscoverTab('dorama')).toBe(true)
		expect(isDiscoverTab('podcast')).toBe(false)
	})
})
