import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { nodeEventReceived } from '@infra/node'

import { fetchTrackerEntriesFx, updateTrackerEntryFx } from '../api/api'
import type { TrackerCollection, TrackerEntry } from '../api/api'

import {
	formatProgress,
	preferredTitle,
	trackerModel,
	trackerQueries,
	updateTrackerEntryMutation
} from './model'

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

const ENTRY: TrackerEntry = {
	media_ref: 'anilist:100',
	provider: 'anilist',
	media_type: 'anime',
	status: 'CURRENT',
	score: 80,
	progress: 7,
	progress_volumes: null,
	repeat: 0,
	private: false,
	notes: '',
	started_at: { year: null, month: null, day: null },
	completed_at: { year: null, month: null, day: null },
	updated_at: '2026-09-15T12:00:00Z',
	custom_lists: [],
	sync_pending: false,
	media: {
		title: { user_preferred: 'Frieren', english: null, romaji: null, native: null },
		format: 'TV',
		status: null,
		episodes: 28,
		chapters: null,
		volumes: null,
		season_year: 2023,
		is_adult: false,
		genres: ['Adventure', 'Drama', 'Fantasy'],
		average_score: 91,
		cover_image: null,
		cover_color: null,
		banner_image: null,
		site_url: ''
	}
}

describe('tracker updates', () => {
	it('put the saved entry into the list right away, without waiting for a refetch', async () => {
		const saved: TrackerEntry = { ...ENTRY, progress: 8, sync_pending: true }

		const scope = fork({
			handlers: [
				[
					fetchTrackerEntriesFx,
					(type: string) => Promise.resolve({ ...EMPTY, media_type: type, entries: [ENTRY] })
				],
				[updateTrackerEntryFx, () => Promise.resolve(saved)]
			]
		})

		await allSettled(trackerQueries.anime.start, { scope })
		await allSettled(trackerQueries.manga.start, { scope })

		await allSettled(updateTrackerEntryMutation.start, {
			scope,
			params: { mediaRef: 'anilist:100', patch: { progress: 8 } }
		})

		expect(scope.getState(trackerQueries.anime.$data)?.entries?.[0]).toEqual(saved)
		expect(scope.getState(trackerQueries.manga.$data)?.entries?.[0]).toEqual(ENTRY)
		expect(scope.getState(trackerModel.$updating)).toEqual({})
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
