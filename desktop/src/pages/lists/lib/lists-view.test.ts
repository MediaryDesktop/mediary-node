import { describe, expect, it } from 'vitest'

import type { MediaSummary } from '@entities/media'
import type { TrackerCustomList } from '@entities/tracker'

import { listsPhase, myTitlesCard, visibleLists } from './lists-view'

function list(id: string, overrides: Partial<TrackerCustomList> = {}): TrackerCustomList {
	return {
		id,
		name: id,
		media_type: 'movie',
		count: 0,
		covers: [],
		updated_at: null,
		...overrides
	} as TrackerCustomList
}

describe('visibleLists', () => {
	const lists = [
		list('Watch later', { count: 3, updated_at: '2026-01-02T00:00:00Z' }),
		list('Books', { media_type: 'book', count: 9, updated_at: '2026-01-03T00:00:00Z' }),
		list('Abandoned', { count: 1 })
	]

	it('keeps the picked type and the names that hold the search', () => {
		const names = (filter: 'all' | 'movie', search: string) =>
			visibleLists(lists, { filter, search, sort: 'name' }).map(item => item.name)

		expect(names('movie', '')).toEqual(['Abandoned', 'Watch later'])
		expect(names('all', '  LATER ')).toEqual(['Watch later'])
	})

	it('puts the most recently changed first, a list never changed last', () => {
		expect(
			visibleLists(lists, { filter: 'all', search: '', sort: 'recent' }).map(item => item.name)
		).toEqual(['Books', 'Watch later', 'Abandoned'])
	})

	it('puts the biggest first', () => {
		expect(
			visibleLists(lists, { filter: 'all', search: '', sort: 'size' }).map(item => item.count)
		).toEqual([9, 3, 1])
	})

	it('leaves the given lists in their order', () => {
		visibleLists(lists, { filter: 'all', search: '', sort: 'name' })

		expect(lists.map(item => item.name)).toEqual(['Watch later', 'Books', 'Abandoned'])
	})
})

describe('myTitlesCard', () => {
	const titles = [
		{ media_type: 'movie', cover_image: 'a.jpg' },
		{ media_type: 'book', cover_image: null }
	] as MediaSummary[]

	it('counts the titles of the picked type and keeps their covers', () => {
		expect(myTitlesCard(titles, { filter: 'all', search: '', name: 'My titles' })).toEqual({
			name: 'My titles',
			count: 2,
			covers: ['a.jpg']
		})
		expect(myTitlesCard(titles, { filter: 'book', search: '', name: 'My titles' })?.count).toBe(1)
	})

	it('hides under a type the user described nothing of, but not under "all"', () => {
		expect(myTitlesCard(titles, { filter: 'series', search: '', name: 'My titles' })).toBeNull()
		expect(myTitlesCard([], { filter: 'all', search: '', name: 'My titles' })?.count).toBe(0)
	})

	it('hides when the search does not match its name', () => {
		expect(myTitlesCard(titles, { filter: 'all', search: 'later', name: 'My titles' })).toBeNull()
	})
})

describe('listsPhase', () => {
	const phase = (shown: boolean, known: boolean, pending: boolean, failed: boolean) =>
		listsPhase({ shown, known, pending, failed })

	it('keeps showing lists through a refetch or a failure', () => {
		expect(phase(true, true, true, true)).toBe('lists')
	})

	it('loads and fails only while nothing is known', () => {
		expect(phase(false, false, true, false)).toBe('loading')
		expect(phase(false, false, false, true)).toBe('failed')
		expect(phase(false, true, true, false)).toBe('idle')
	})

	it('is empty once the answer came with nothing to show', () => {
		expect(phase(false, true, false, false)).toBe('empty')
		expect(phase(false, false, false, false)).toBe('empty')
	})
})
