import { describe, expect, it } from 'vitest'

import type { TorrentRelease } from '@entities/torrent'

import { streamEpisode } from './stream-episode'

function release(fields: Partial<TorrentRelease>): TorrentRelease {
	return { id: 'r', title: 'x', ...fields } as TorrentRelease
}

const nothingSearched = { episode: '', season: '' }

describe('which episode a release plays', () => {
	it('plays a single-episode release as that episode', () => {
		expect(streamEpisode(release({ episodes: { from: 5, to: 5 }, season: 2 }), nothingSearched)).toEqual({
			episode: 5,
			season: 2
		})
	})

	it('plays the searched episode out of a batch that holds it', () => {
		const batch = release({ episodes: { from: 1, to: 12 } })

		expect(streamEpisode(batch, { episode: '7', season: '' })).toEqual({ episode: 7, season: undefined })
		expect(streamEpisode(batch, { episode: '13', season: '' })).toBeNull()
		expect(streamEpisode(batch, nothingSearched)).toBeNull()
	})

	it('plays a release without episodes, like a film, as a whole', () => {
		expect(streamEpisode(release({}), nothingSearched)).toEqual({ season: undefined })
	})
})
