import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { HttpRequestError } from '@shared/api'

import { searchMediaFx } from '@entities/media'
import type { MediaSearchQuery, MediaSearchResponse } from '@entities/media'

import { discoverSections } from '../lib/sections'

import { discoverModel } from './model'

function response(ref: string): MediaSearchResponse {
	return {
		results: {
			items: [
				{
					media_ref: ref,
					media_type: 'movie',
					format: 'MOVIE',
					status: null,
					title: { user_preferred: ref, romaji: null, english: null, native: null },
					cover_image: null,
					cover_color: null,
					banner_image: null,
					episodes: 1,
					chapters: null,
					volumes: null,
					season: null,
					season_year: 2026,
					start_date: { year: 2026, month: null, day: null },
					average_score: 80,
					popularity: null,
					genres: [],
					is_adult: false,
					site_url: '',
					next_airing_episode: null
				}
			],
			page: 1,
			per_page: 20,
			total: 1,
			has_next_page: false
		},
		sources: []
	}
}

describe('discover model', () => {
	it('fills every row once and keeps it while it is fresh', async () => {
		const search = vi.fn((query: MediaSearchQuery) =>
			Promise.resolve(response(`${query.type}:${query.sort}`))
		)
		const scope = fork({ handlers: [[searchMediaFx, search]] })
		const rows = discoverSections('movie', new Date())

		await allSettled(discoverModel.sectionsRequested, { scope, params: rows })

		const sections = scope.getState(discoverModel.$sections)
		expect(search).toHaveBeenCalledTimes(rows.length)
		expect(sections['movie:popular']?.items[0]?.media_ref).toBe('movie:POPULARITY_DESC')
		expect(sections['movie:topRated']?.status).toBe('done')

		await allSettled(discoverModel.sectionsRequested, { scope, params: rows })
		expect(search).toHaveBeenCalledTimes(rows.length)
	})

	it('tells a missing TMDB key from a failure, and tries a failed row again', async () => {
		let fail = true
		const search = vi.fn(() =>
			fail
				? Promise.reject(
						new HttpRequestError('precondition', {
							status: 428,
							body: { detail: 'TMDB is not set up: add an API key in the settings' }
						})
					)
				: Promise.resolve(response('tmdb:movie:603'))
		)
		const scope = fork({ handlers: [[searchMediaFx, search]] })
		const rows = discoverSections('movie', new Date())

		await allSettled(discoverModel.sectionsRequested, { scope, params: rows })
		expect(scope.getState(discoverModel.$sections)['movie:popular']?.setupNeeded).toContain('TMDB')

		fail = false
		await allSettled(discoverModel.sectionsRequested, { scope, params: rows })

		const popular = scope.getState(discoverModel.$sections)['movie:popular']
		expect(popular?.status).toBe('done')
		expect(popular?.setupNeeded).toBeNull()
	})
})
