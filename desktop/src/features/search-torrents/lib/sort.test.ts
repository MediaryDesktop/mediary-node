import { describe, expect, it } from 'vitest'

import type { TorrentRelease } from '@entities/torrent'

import { flipSort, formatSort, parseSort, sortBy, sortReleases, UNSORTED } from './sort'

function release(id: string, fields: Partial<TorrentRelease>): TorrentRelease {
	return {
		id,
		source_id: 1,
		source_name: 'Jackett',
		title: id,
		size: 0,
		seeders: 0,
		peers: 0,
		grabs: 0,
		batch: false,
		match: 'any',
		score: 0,
		eligible: true,
		best: false,
		...fields
	}
}

const a = release('a', { seeders: 5, size: 300, resolution: '720p', published_at: '2026-01-01T00:00:00Z' })
const b = release('b', { seeders: 50, size: 100, resolution: '2160p', published_at: '2026-03-01T00:00:00Z' })
const c = release('c', { seeders: 20, size: 200, resolution: '1080p' })

const ids = (releases: TorrentRelease[]) => releases.map(found => found.id)

describe('sortBy and flipSort', () => {
	it('starts a field largest first', () => {
		expect(sortBy('seeders')).toEqual({ field: 'seeders', direction: 'desc' })
		expect(sortBy(null)).toEqual(UNSORTED)
	})

	it('flips the direction and keeps the field', () => {
		expect(flipSort(sortBy('size'))).toEqual({ field: 'size', direction: 'asc' })
		expect(flipSort(flipSort(sortBy('size')))).toEqual(sortBy('size'))
	})
})

describe('sortReleases', () => {
	it('keeps the node order without a field', () => {
		expect(ids(sortReleases([a, b, c], UNSORTED))).toEqual(['a', 'b', 'c'])
	})

	it('sorts by each field', () => {
		expect(ids(sortReleases([a, b, c], { field: 'seeders', direction: 'desc' }))).toEqual(['b', 'c', 'a'])
		expect(ids(sortReleases([a, b, c], { field: 'size', direction: 'asc' }))).toEqual(['b', 'c', 'a'])
		expect(ids(sortReleases([a, b, c], { field: 'resolution', direction: 'desc' }))).toEqual([
			'b',
			'c',
			'a'
		])
	})

	it('puts releases without a date last when newest come first', () => {
		expect(ids(sortReleases([c, a, b], { field: 'date', direction: 'desc' }))).toEqual(['b', 'a', 'c'])
	})

	it('does not reorder the list it was given', () => {
		const list = [a, b, c]
		sortReleases(list, { field: 'seeders', direction: 'desc' })
		expect(ids(list)).toEqual(['a', 'b', 'c'])
	})
})

describe('parseSort', () => {
	it('reads back what formatSort wrote', () => {
		const sort = { field: 'date', direction: 'asc' } as const
		expect(parseSort(formatSort(sort))).toEqual(sort)
		expect(parseSort(formatSort(UNSORTED))).toEqual(UNSORTED)
	})

	it('falls back to the node order on anything unknown', () => {
		expect(parseSort(null)).toEqual(UNSORTED)
		expect(parseSort('peers:desc')).toEqual(UNSORTED)
	})
})
