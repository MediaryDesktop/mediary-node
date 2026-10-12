import { describe, expect, it } from 'vitest'

import type { TrackerEntry } from '@entities/tracker'

import { activity, trackerStats } from './stats'

interface Part {
	progress?: number
	genres?: string[]
	score?: number
	started?: [number, number]
	completed?: [number, number]
	updated?: string
}

function entry(mediaRef: string, mediaType: string, status: string, part: Part = {}): TrackerEntry {
	const date = (value?: [number, number]) =>
		value ? { year: value[0], month: value[1], day: 1 } : { year: null, month: null, day: null }

	return {
		media_ref: mediaRef,
		media_type: mediaType,
		status,
		progress: part.progress ?? 0,
		score: part.score ?? 0,
		started_at: date(part.started),
		completed_at: date(part.completed),
		updated_at: part.updated ?? '2026-10-01T00:00:00Z',
		media: { genres: part.genres ?? [] }
	} as unknown as TrackerEntry
}

const NOW = new Date(2026, 9, 11)

describe('trackerStats', () => {
	it('counts titles, statuses and progress by kind', () => {
		const stats = trackerStats(
			[
				entry('anilist:1', 'anime', 'COMPLETED', { progress: 12, completed: [2026, 10] }),
				entry('anilist:2', 'anime', 'CURRENT', { progress: 3 }),
				entry('anilist:3', 'manga', 'CURRENT', { progress: 40 }),
				entry('tmdb:movie:1', 'movie', 'COMPLETED', { progress: 1, completed: [2026, 9] }),
				entry('book:1', 'book', 'CURRENT', { progress: 120 })
			],
			NOW
		)

		expect(stats.titles).toBe(5)
		expect(stats.completed).toBe(2)
		expect(stats.completedThisMonth).toBe(1)
		expect(stats.episodes).toBe(16)
		expect(stats.chapters).toBe(40)
		expect(stats.byStatus.CURRENT).toBe(3)
	})

	it('lists media types in a fixed order and leaves empty ones out', () => {
		const stats = trackerStats([
			entry('book:1', 'book', 'PLANNING'),
			entry('anilist:1', 'anime', 'PLANNING'),
			entry('anilist:2', 'anime', 'DROPPED')
		])

		expect(stats.byType.map(row => [row.type, row.total])).toEqual([
			['anime', 2],
			['book', 1]
		])
		expect(stats.byType[0]?.counts.DROPPED).toBe(1)
	})

	it('ranks genres of what the user started, leaving plans out', () => {
		const stats = trackerStats([
			entry('anilist:1', 'anime', 'COMPLETED', { progress: 12, genres: ['Action', 'Drama'] }),
			entry('anilist:2', 'anime', 'CURRENT', { progress: 3, genres: ['Action'] }),
			entry('anilist:3', 'anime', 'PLANNING', { genres: ['Romance'] })
		])

		expect(stats.genres).toEqual([
			{ name: 'Action', count: 2 },
			{ name: 'Drama', count: 1 }
		])
		expect(stats.genreTags).toBe(3)
		expect(stats.watchedTitles).toBe(2)
	})

	it('reads scores on the ten-point scale and ranks the best', () => {
		const stats = trackerStats([
			entry('anilist:1', 'anime', 'COMPLETED', { score: 90 }),
			entry('anilist:2', 'anime', 'COMPLETED', { score: 75 }),
			entry('anilist:3', 'anime', 'CURRENT')
		])

		expect(stats.meanScore).toBe(8.3)
		expect(stats.scored).toBe(2)
		expect(stats.scores.find(bucket => bucket.score === 8)?.count).toBe(1)
		expect(stats.scores.find(bucket => bucket.score === 9)?.count).toBe(1)
		expect(stats.topRated.map(item => item.media_ref)).toEqual(['anilist:1', 'anilist:2'])
	})

	it('counts a title held in two lists once', () => {
		const stats = trackerStats([
			entry('tmdb:tv:1', 'series', 'CURRENT', { progress: 5 }),
			entry('tmdb:tv:1', 'dorama', 'CURRENT', { progress: 5 })
		])

		expect(stats.titles).toBe(1)
		expect(stats.episodes).toBe(5)
	})
})

describe('activity', () => {
	const entries = [
		entry('anilist:1', 'anime', 'COMPLETED', { started: [2026, 8], completed: [2026, 10] }),
		entry('anilist:2', 'anime', 'CURRENT', { started: [2026, 10] }),
		entry('anilist:3', 'anime', 'COMPLETED', { started: [2024, 1], completed: [2024, 3] })
	]

	it('counts starts and finishes month by month, ending this month', () => {
		const points = activity(entries, '6m', NOW)

		expect(points.map(point => point.month)).toEqual([5, 6, 7, 8, 9, 10])
		expect(points.at(-1)).toMatchObject({ year: 2026, month: 10, started: 1, completed: 1 })
		expect(points[3]).toMatchObject({ month: 8, started: 1 })
	})

	it('goes year by year over all time', () => {
		const points = activity(entries, 'all', NOW)

		expect(points.map(point => [point.year, point.started, point.completed])).toEqual([
			[2024, 1, 1],
			[2025, 0, 0],
			[2026, 2, 1]
		])
	})
})
