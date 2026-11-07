import { describe, expect, it } from 'vitest'

import { MAX_EPISODES, streamItems, upNext } from './stream-items'

const labels = {
	episode: (number: number) => `E${number}`,
	seasonEpisode: (season: number, number: number) => `S${season}E${number}`
}

const flat = { seasonal: false, list: [], byKey: new Map(), position: new Map() }

describe('streamItems', () => {
	it('is the film itself for a movie', () => {
		expect(
			streamItems({ mediaType: 'movie', title: 'Akira', meta: flat, released: null, labels })
		).toEqual([{ key: 'movie', label: 'Akira', meta: undefined, position: 1 }])
	})

	it('counts a show numbered straight through up to the last episode out', () => {
		const items = streamItems({ mediaType: 'anime', title: 'X', meta: flat, released: 3, labels })

		expect(items.map(item => [item.key, item.label, item.position])).toEqual([
			[':1', 'E1', 1],
			[':2', 'E2', 2],
			[':3', 'E3', 3]
		])
	})

	it('lists a seasonal show by season, in watching order', () => {
		const list = [
			{ season: 1, number: 1 },
			{ season: 1, number: 2 },
			{ season: 2, number: 1 }
		] as never[]
		const meta = { seasonal: true, list, byKey: new Map(), position: new Map() }

		const items = streamItems({ mediaType: 'series', title: 'X', meta, released: null, labels })

		expect(items.map(item => [item.key, item.label, item.season, item.position])).toEqual([
			['1:1', 'S1E1', 1, 1],
			['1:2', 'S1E2', 1, 2],
			['2:1', 'S2E1', 2, 3]
		])
	})

	it('stops at a sane number of episodes', () => {
		const items = streamItems({ mediaType: 'anime', title: 'X', meta: flat, released: 1100, labels })

		expect(items).toHaveLength(MAX_EPISODES)
	})

	it('offers nothing when no episode is out yet', () => {
		expect(streamItems({ mediaType: 'anime', title: 'X', meta: flat, released: null, labels })).toEqual(
			[]
		)
	})
})

describe('upNext', () => {
	it('is the next few after where the viewer is', () => {
		const items = streamItems({ mediaType: 'anime', title: 'X', meta: flat, released: 10, labels })

		expect(upNext(items, 3, 2).map(item => item.position)).toEqual([4, 5])
	})
})
