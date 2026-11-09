import { describe, expect, it } from 'vitest'

import type { TorrentRelease, TorrentSearchResult } from '@entities/torrent'

import {
	ALL_SOURCES,
	emptyReason,
	filterBySource,
	foundCount,
	releaseSourceKey,
	sourceOptions
} from './sources'

function release(id: string, source: { source_id: number; plugin?: string }): TorrentRelease {
	return {
		id,
		source_name: 'Source',
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
		...source
	}
}

const jackett = release('jackett', { source_id: 3 })
const plugin = release('plugin', { source_id: 0, plugin: 'anilibria' })

describe('releaseSourceKey', () => {
	it('tells a plugin from a Torznab source', () => {
		expect(releaseSourceKey(jackett)).toBe('source:3')
		expect(releaseSourceKey(plugin)).toBe('plugin:anilibria')
	})
})

describe('sourceOptions', () => {
	it('lists the sources that found something, by name', () => {
		const result = {
			queries: [],
			releases: [],
			sources: [
				{ id: 3, name: 'Jackett', results: 4 },
				{ id: 0, plugin: 'anilibria', name: 'AniLiberty', results: 2 },
				{ id: 5, name: 'Prowlarr', results: 0, error: 'timeout' }
			]
		} as TorrentSearchResult

		expect(sourceOptions(result)).toEqual([
			{ key: 'plugin:anilibria', name: 'AniLiberty', results: 2 },
			{ key: 'source:3', name: 'Jackett', results: 4 }
		])
	})

	it('is empty before a search', () => {
		expect(sourceOptions(null)).toEqual([])
	})
})

describe('filterBySource', () => {
	it('keeps every release for all sources', () => {
		expect(filterBySource([jackett, plugin], ALL_SOURCES)).toEqual([jackett, plugin])
	})

	it('keeps the releases of one source', () => {
		expect(filterBySource([jackett, plugin], 'plugin:anilibria')).toEqual([plugin])
	})
})

describe('emptyReason', () => {
	const result = (releases: TorrentRelease[], found: number) =>
		({
			queries: ['Frieren'],
			releases,
			sources: [{ id: 3, name: 'Jackett', results: found }]
		}) as TorrentSearchResult

	it('blames the filters when the node sent releases', () => {
		expect(emptyReason(result([jackett], 1), 3)).toBe('filtered')
	})

	it('blames the episode when sources found releases the node dropped', () => {
		expect(emptyReason(result([], 4), 3)).toBe('episode')
		expect(foundCount(result([], 4))).toBe(4)
	})

	it('says nothing was found otherwise', () => {
		expect(emptyReason(result([], 0), 3)).toBe('nothing')
		expect(emptyReason(result([], 4), 0)).toBe('nothing')
	})
})
