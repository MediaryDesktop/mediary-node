import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { fetchMediaFilterOptionsFx, searchMediaFx } from '@entities/media'
import type { MediaSearchQuery, MediaSearchResponse, MediaSummary } from '@entities/media'

import { searchMediaModel } from './model'

function title(mediaRef: string): MediaSummary {
	return {
		media_ref: mediaRef,
		media_type: 'anime',
		format: 'TV',
		status: 'FINISHED',
		title: { user_preferred: mediaRef, romaji: null, english: null, native: null },
		cover_image: null,
		cover_color: null,
		banner_image: null,
		episodes: 12,
		chapters: null,
		volumes: null,
		season: 'FALL',
		season_year: 2023,
		start_date: { year: 2023, month: 9, day: 29 },
		average_score: 80,
		popularity: 1000,
		genres: [],
		is_adult: false,
		site_url: '',
		next_airing_episode: null
	}
}

function page(items: string[], hasNextPage: boolean): MediaSearchResponse {
	return {
		results: {
			items: items.map(title),
			page: 1,
			per_page: 30,
			total: 100,
			has_next_page: hasNextPage
		},
		sources: []
	}
}

function searchScope(search: (query: MediaSearchQuery) => Promise<MediaSearchResponse>) {
	return fork({
		handlers: [
			[searchMediaFx, search],
			[
				fetchMediaFilterOptionsFx,
				() => Promise.resolve({ options: { genres: [], tags: [], fetched_at: '' }, sources: [] })
			]
		]
	})
}

describe('search sorting', () => {
	it('follows the query into relevance and back out of it', async () => {
		const search = vi.fn().mockResolvedValue(page([], false))
		const scope = searchScope(search)

		await allSettled(searchMediaModel.titleChanged, { scope, params: 'frieren' })
		expect(scope.getState(searchMediaModel.$filters).sort).toBe('SEARCH_MATCH')

		await allSettled(searchMediaModel.titleChanged, { scope, params: '' })
		expect(scope.getState(searchMediaModel.$filters).sort).toBe('POPULARITY_DESC')
	})

	it('leaves a sort the user picked alone', async () => {
		const search = vi.fn().mockResolvedValue(page([], false))
		const scope = searchScope(search)

		await allSettled(searchMediaModel.filtersPatched, { scope, params: { sort: 'SCORE_DESC' } })
		await allSettled(searchMediaModel.titleChanged, { scope, params: 'frieren' })

		expect(scope.getState(searchMediaModel.$filters).sort).toBe('SCORE_DESC')
	})
})

describe('search paging', () => {
	it('appends the next page and starts over when the filters change', async () => {
		const search = vi.fn(async (query: MediaSearchQuery) =>
			query.page === 2
				? page(['anilist:3', 'anilist:4'], false)
				: page(['anilist:1', 'anilist:2'], true)
		)

		const scope = searchScope(search)

		await allSettled(searchMediaModel.pageOpened, { scope })
		expect(scope.getState(searchMediaModel.$items)).toHaveLength(2)

		await allSettled(searchMediaModel.nextPageRequested, { scope })
		expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
		expect(scope.getState(searchMediaModel.$items).map(media => media.media_ref)).toEqual([
			'anilist:1',
			'anilist:2',
			'anilist:3',
			'anilist:4'
		])

		await allSettled(searchMediaModel.filtersPatched, { scope, params: { genres: ['Action'] } })
		expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, genres: ['Action'] }))
		expect(scope.getState(searchMediaModel.$items)).toHaveLength(2)
	})

	it('collapses a burst of filter changes into one request', async () => {
		const search = vi.fn().mockResolvedValue(page(['anilist:1'], false))
		const scope = searchScope(search)

		await allSettled(searchMediaModel.pageOpened, { scope })
		expect(search).toHaveBeenCalledTimes(1)

		await Promise.all([
			allSettled(searchMediaModel.filtersPatched, { scope, params: { genres: ['Action'] } }),
			allSettled(searchMediaModel.filtersPatched, {
				scope,
				params: { genres: ['Action', 'Adventure'] }
			}),
			allSettled(searchMediaModel.filtersPatched, { scope, params: { statuses: ['FINISHED'] } })
		])

		expect(search).toHaveBeenCalledTimes(2)
		expect(search).toHaveBeenLastCalledWith(
			expect.objectContaining({ genres: ['Action', 'Adventure'], statuses: ['FINISHED'] })
		)
	})

	it('does not ask for a page the source said is not there', async () => {
		const search = vi.fn().mockResolvedValue(page(['anilist:1'], false))
		const scope = searchScope(search)

		await allSettled(searchMediaModel.pageOpened, { scope })
		await allSettled(searchMediaModel.nextPageRequested, { scope })

		expect(search).toHaveBeenCalledTimes(1)
	})
})

describe('search filters', () => {
	it('drops formats that belong to the other media type', async () => {
		const search = vi.fn().mockResolvedValue(page([], false))
		const scope = searchScope(search)

		await allSettled(searchMediaModel.filtersPatched, { scope, params: { formats: ['MOVIE'] } })
		await allSettled(searchMediaModel.filtersPatched, { scope, params: { type: 'manga' } })

		expect(scope.getState(searchMediaModel.$filters).formats).toEqual([])
		expect(search).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: 'manga', formats: undefined })
		)
	})

	it('counts only the groups the user narrowed', async () => {
		const scope = searchScope(() => Promise.resolve(page([], false)))

		expect(scope.getState(searchMediaModel.$activeFilterCount)).toBe(0)

		await allSettled(searchMediaModel.filtersPatched, {
			scope,
			params: { genres: ['Action'], year: 2023, adult: true }
		})
		expect(scope.getState(searchMediaModel.$activeFilterCount)).toBe(3)

		await allSettled(searchMediaModel.filtersCleared, { scope })
		expect(scope.getState(searchMediaModel.$activeFilterCount)).toBe(0)
	})
})
