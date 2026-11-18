import { describe, expect, it } from 'vitest'

import { activeGroups, applyPatch, INITIAL_FILTERS, requestOf, sameCriteria } from './filters'

const ANIME = { ...INITIAL_FILTERS, type: 'anime' as const }

describe('applyPatch', () => {
	it('keeps every filter while the type stays the same', () => {
		const filters = { ...ANIME, genres: ['Action'], formats: ['TV' as const] }

		expect(applyPatch(filters, { year: 2020 })).toEqual({ ...filters, year: 2020 })
		expect(applyPatch(filters, { type: 'anime' }).formats).toEqual(['TV'])
	})

	it('drops formats on any change of type, and genres when the vocabulary changes', () => {
		const anime = { ...ANIME, genres: ['Action'], formats: ['TV' as const] }

		expect(applyPatch(anime, { type: 'manga' })).toMatchObject({ formats: [], genres: ['Action'] })
		expect(applyPatch({ ...INITIAL_FILTERS, genres: ['Drama'] }, { type: 'dorama' }).genres).toEqual([
			'Drama'
		])
		expect(applyPatch({ ...INITIAL_FILTERS, genres: ['Drama'] }, { type: 'movie' }).genres).toEqual([])
	})

	it('drops what only AniList knows when leaving anime and manga', () => {
		const anime = {
			...ANIME,
			tags: ['Isekai'],
			statuses: ['RELEASING' as const],
			season: 'WINTER' as const
		}

		expect(applyPatch(anime, { type: 'series' })).toMatchObject({ tags: [], statuses: [], season: null })
	})
})

describe('activeGroups', () => {
	it('counts each kind of filter once', () => {
		expect(activeGroups(INITIAL_FILTERS)).toBe(0)
		expect(activeGroups({ ...INITIAL_FILTERS, genres: ['A', 'B'], year: 2020, adult: true })).toBe(3)
	})
})

describe('requestOf', () => {
	it('sends only what the source of the type understands', () => {
		const series = { ...INITIAL_FILTERS, tags: ['Isekai'], season: 'WINTER' as const, genres: ['Drama'] }

		expect(requestOf('  frieren ', series, 2)).toMatchObject({
			q: 'frieren',
			genres: ['Drama'],
			tags: undefined,
			season: undefined,
			page: 2
		})
		expect(requestOf('', { ...ANIME, season: 'WINTER' }, 1)).toMatchObject({
			q: undefined,
			season: 'WINTER'
		})
	})
})

describe('sameCriteria', () => {
	it('ignores spaces around the title', () => {
		expect(sameCriteria({ title: ' a ', filters: ANIME }, { title: 'a', filters: { ...ANIME } })).toBe(
			true
		)
		expect(sameCriteria({ title: 'a', filters: ANIME }, { title: 'a', filters: INITIAL_FILTERS })).toBe(
			false
		)
	})
})
