import { describe, expect, it } from 'vitest'

import type { TrackerEntry } from '@entities/tracker'

import { ANY, applyEntryFilters, formatsOf, hasActiveFilters, INITIAL_ENTRY_FILTERS } from './entry-filters'

function entry(part: {
	ref: string
	name: string
	status?: string
	format?: string | null
	score?: number
	progress?: number
	updated?: string
}): TrackerEntry {
	return {
		media_ref: part.ref,
		provider: 'anilist',
		media_type: 'anime',
		status: part.status ?? 'CURRENT',
		score: part.score ?? 0,
		progress: part.progress ?? 0,
		progress_volumes: null,
		repeat: 0,
		private: false,
		notes: '',
		started_at: { year: null, month: null, day: null },
		completed_at: { year: null, month: null, day: null },
		updated_at: part.updated ?? '2026-01-01T00:00:00Z',
		custom_lists: [],
		sync_pending: false,
		media: {
			title: { user_preferred: part.name, english: null, romaji: null, native: null },
			format: part.format ?? 'TV',
			status: 'FINISHED',
			episodes: 12,
			chapters: null,
			volumes: null,
			season_year: 2024,
			is_adult: false,
			cover_image: null,
			cover_color: null,
			banner_image: null,
			site_url: 'https://anilist.co'
		}
	} as TrackerEntry
}

const ENTRIES = [
	entry({ ref: 'a', name: 'Frieren', status: 'CURRENT', format: 'TV', score: 90, progress: 4 }),
	entry({ ref: 'b', name: 'Bocchi', status: 'COMPLETED', format: 'TV', score: 70, progress: 12 }),
	entry({ ref: 'c', name: 'Suzume', status: 'COMPLETED', format: 'MOVIE', score: 80, progress: 1 })
]

const refs = (entries: TrackerEntry[]) => entries.map(item => item.media_ref)

describe('applyEntryFilters', () => {
	it('keeps everything and the original order by default', () => {
		expect(refs(applyEntryFilters(ENTRIES, INITIAL_ENTRY_FILTERS))).toEqual(['a', 'b', 'c'])
	})

	it('narrows by list status and by format', () => {
		expect(refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, status: 'COMPLETED' }))).toEqual([
			'b',
			'c'
		])

		expect(refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, format: 'MOVIE' }))).toEqual(['c'])
	})

	it('matches a title case-insensitively across every name it has', () => {
		expect(refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, title: '  frie ' }))).toEqual([
			'a'
		])
	})

	it('sorts without dropping anything', () => {
		expect(refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, sort: 'title' }))).toEqual([
			'b',
			'a',
			'c'
		])

		expect(refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, sort: 'score' }))).toEqual([
			'a',
			'c',
			'b'
		])
	})

	it('combines filters', () => {
		expect(
			refs(applyEntryFilters(ENTRIES, { ...INITIAL_ENTRY_FILTERS, status: 'COMPLETED', format: 'TV' }))
		).toEqual(['b'])
	})
})

describe('formatsOf', () => {
	it('offers each present format once, sorted', () => {
		expect(formatsOf(ENTRIES)).toEqual(['MOVIE', 'TV'])
	})
})

describe('hasActiveFilters', () => {
	it('is false only for the untouched set', () => {
		expect(hasActiveFilters(INITIAL_ENTRY_FILTERS)).toBe(false)
		expect(hasActiveFilters({ ...INITIAL_ENTRY_FILTERS, status: 'CURRENT' })).toBe(true)
		expect(hasActiveFilters({ ...INITIAL_ENTRY_FILTERS, status: ANY, title: ' ' })).toBe(false)
	})
})
