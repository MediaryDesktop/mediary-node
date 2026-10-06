import { describe, expect, it } from 'vitest'

import type { TorrentRelease } from '@entities/torrent'

import { coveredEpisodes, missingEpisodes, summarizeEpisodes } from './episodes'

function release(from: number, to: number): TorrentRelease {
	return {
		id: 'r',
		source_id: 1,
		source_name: 'Jackett',
		title: 'Frieren',
		size: 1,
		seeders: 1,
		peers: 0,
		grabs: 0,
		batch: from !== to,
		match: 'any',
		score: 0,
		eligible: true,
		best: false,
		episodes: { from, to }
	}
}

describe('missing torrent episodes', () => {
	it('are the released ones not on disk or on their way', () => {
		expect(missingEpisodes(6, [1, 2, 5])).toEqual([3, 4, 6])
	})

	it('are unknown when the episode count is', () => {
		expect(missingEpisodes(null, [1])).toBeNull()
		expect(missingEpisodes(0, [])).toBeNull()
	})

	it('a release covers the missing ones in its range', () => {
		expect(coveredEpisodes(release(1, 12), [3, 4, 13])).toEqual([3, 4])
		expect(coveredEpisodes(release(7, 7), [3, 4])).toEqual([])
		expect(coveredEpisodes(release(1, 12), null)).toEqual([])
	})

	it('a long list keeps the first few and the last', () => {
		expect(summarizeEpisodes([1, 2, 3])).toBe('1, 2, 3')
		expect(summarizeEpisodes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('1, 2, 3, 4, 5, …, 12')
	})
})
