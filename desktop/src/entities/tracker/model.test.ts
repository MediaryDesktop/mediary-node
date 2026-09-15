import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { nodeEventReceived } from '@infra/node'

import { fetchTrackerEntriesFx } from './api'
import type { TrackerCollection } from './api'
import { formatProgress, preferredTitle, trackerQueries } from './model'

const EMPTY: TrackerCollection = {
	media_type: 'anime',
	entries: [],
	lists: [],
	fetched_at: '2026-09-15T12:00:00Z',
	stale: false,
	sources: []
}

describe('tracker queries', () => {
	it('refetch only when the node announces a change for their media type', async () => {
		const fetch = vi.fn().mockResolvedValue(EMPTY)

		const scope = fork({ handlers: [[fetchTrackerEntriesFx, fetch]] })

		await allSettled(trackerQueries.anime.start, { scope })
		expect(fetch).toHaveBeenCalledTimes(1)
		expect(fetch).toHaveBeenLastCalledWith('anime')

		await allSettled(nodeEventReceived, {
			scope,
			params: { topic: 'tracker', at: '', payload: { media_type: 'manga' } }
		})
		expect(fetch).toHaveBeenCalledTimes(1)

		await allSettled(nodeEventReceived, {
			scope,
			params: { topic: 'tracker', at: '', payload: { media_type: 'anime' } }
		})
		expect(fetch).toHaveBeenCalledTimes(2)
	})
})

describe('tracker formatting', () => {
	it('shows a total only when the source knows it', () => {
		expect(formatProgress(3, 12)).toBe('3 / 12')
		expect(formatProgress(3, null)).toBe('3')
	})

	it('prefers the title the user chose on AniList', () => {
		expect(
			preferredTitle({ user_preferred: null, english: 'Frieren', romaji: 'Sousou', native: null })
		).toBe('Frieren')
	})
})
