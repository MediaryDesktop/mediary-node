import { describe, expect, it } from 'vitest'

import type { TorrentRelease } from '@entities/torrent'

import { applyQuickFilters, toggleQuickFilter } from './quick-filters'
import type { QuickFilter } from './quick-filters'

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

const best = release('best', { best: true, resolution: '1080p', seeders: 40 })
const sd = release('sd', { resolution: '480p', seeders: 3 })
const dead = release('dead', { resolution: '2160p', seeders: 0 })
const all = [best, sd, dead]

const ids = (releases: TorrentRelease[]) => releases.map(found => found.id)
const on = (...filters: QuickFilter[]) => new Set(filters)

describe('applyQuickFilters', () => {
	it('keeps everything with no filter on', () => {
		expect(ids(applyQuickFilters(all, on()))).toEqual(['best', 'sd', 'dead'])
	})

	it('narrows by each filter', () => {
		expect(ids(applyQuickFilters(all, on('best')))).toEqual(['best'])
		expect(ids(applyQuickFilters(all, on('hd')))).toEqual(['best', 'dead'])
		expect(ids(applyQuickFilters(all, on('seeded')))).toEqual(['best', 'sd'])
	})

	it('wants every filter that is on', () => {
		expect(ids(applyQuickFilters(all, on('hd', 'seeded')))).toEqual(['best'])
	})
})

describe('toggleQuickFilter', () => {
	it('turns a filter on and off without touching the set it was given', () => {
		const before = on('best')
		expect([...toggleQuickFilter(before, 'hd')]).toEqual(['best', 'hd'])
		expect([...toggleQuickFilter(before, 'best')]).toEqual([])
		expect([...before]).toEqual(['best'])
	})
})
