import { TRACKER_MEDIA_TYPES, TRACKER_STATUSES } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType, TrackerStatus } from '@entities/tracker'

export type StatusCounts = Record<TrackerStatus, number>

export interface TypeBreakdown {
	type: TrackerMediaType
	total: number
	counts: StatusCounts
}

export interface GenreCount {
	name: string
	count: number
}

export interface ScoreBucket {
	score: number
	count: number
}

export interface TrackerStats {
	titles: number
	completed: number
	completedThisMonth: number
	episodes: number
	watchedTitles: number
	chapters: number
	readTitles: number
	meanScore: number | null
	scored: number
	scores: ScoreBucket[]
	topRated: TrackerEntry[]
	byStatus: StatusCounts
	byType: TypeBreakdown[]
	genres: GenreCount[]
	genreTags: number
}

const WATCHED_TYPES = new Set<string>(['anime', 'movie', 'series', 'dorama'])

const TOP_RATED = 5

export function emptyCounts(): StatusCounts {
	return Object.fromEntries(TRACKER_STATUSES.map(status => [status, 0])) as StatusCounts
}

export function uniqueEntries(entries: TrackerEntry[]): TrackerEntry[] {
	return [...new Map(entries.map(entry => [entry.media_ref, entry])).values()]
}

export function trackerStats(entries: TrackerEntry[], now = new Date()): TrackerStats {
	const unique = uniqueEntries(entries)

	const byStatus = emptyCounts()
	const byType = new Map<string, TypeBreakdown>()
	const genres = new Map<string, number>()
	const scores = Array.from({ length: 10 }, (_, index) => ({ score: index + 1, count: 0 }))
	let episodes = 0
	let watchedTitles = 0
	let chapters = 0
	let readTitles = 0
	let scoreSum = 0
	let scored = 0
	let completedThisMonth = 0

	for (const entry of unique) {
		const status = entry.status as TrackerStatus
		if (!(status in byStatus)) {
			continue
		}

		byStatus[status]++

		let row = byType.get(entry.media_type)
		if (!row) {
			row = { type: entry.media_type as TrackerMediaType, total: 0, counts: emptyCounts() }
			byType.set(entry.media_type, row)
		}
		row.total++
		row.counts[status]++

		if (WATCHED_TYPES.has(entry.media_type)) {
			episodes += entry.progress
			watchedTitles += entry.progress > 0 ? 1 : 0
		} else if (entry.media_type === 'manga') {
			chapters += entry.progress
			readTitles += entry.progress > 0 ? 1 : 0
		}

		if (entry.score > 0) {
			scoreSum += entry.score
			scored++
			const bucket = scores[Math.min(10, Math.max(1, Math.ceil(entry.score / 10))) - 1]
			if (bucket) {
				bucket.count++
			}
		}

		const done = entry.completed_at
		if (status === 'COMPLETED' && done?.year === now.getFullYear() && done.month === now.getMonth() + 1) {
			completedThisMonth++
		}

		if (status !== 'PLANNING') {
			for (const genre of entry.media.genres ?? []) {
				genres.set(genre, (genres.get(genre) ?? 0) + 1)
			}
		}
	}

	return {
		titles: unique.length,
		completed: byStatus.COMPLETED,
		completedThisMonth,
		episodes,
		watchedTitles,
		chapters,
		readTitles,
		meanScore: scored > 0 ? Math.round(scoreSum / scored) / 10 : null,
		scored,
		scores,
		topRated: unique
			.filter(entry => entry.score > 0)
			.sort((a, b) => b.score - a.score || Date.parse(b.updated_at) - Date.parse(a.updated_at))
			.slice(0, TOP_RATED),
		byStatus,
		byType: TRACKER_MEDIA_TYPES.flatMap(type => {
			const row = byType.get(type)
			return row ? [row] : []
		}),
		genres: [...genres]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
		genreTags: [...genres.values()].reduce((sum, count) => sum + count, 0)
	}
}

export type ActivityRange = '6m' | '1y' | 'all'

export interface ActivityPoint {
	year: number
	month: number | null
	started: number
	completed: number
}

export function activity(entries: TrackerEntry[], range: ActivityRange, now = new Date()): ActivityPoint[] {
	const unique = uniqueEntries(entries)

	if (range === 'all') {
		const years = unique.flatMap(entry =>
			[entry.started_at?.year, entry.completed_at?.year].filter((year): year is number => year != null)
		)
		if (years.length === 0) {
			return []
		}

		const first = Math.min(...years)
		const points = Array.from({ length: now.getFullYear() - first + 1 }, (_, index) => ({
			year: first + index,
			month: null,
			started: 0,
			completed: 0
		}))

		for (const entry of unique) {
			const started = points.find(point => point.year === entry.started_at?.year)
			const completed = points.find(point => point.year === entry.completed_at?.year)
			if (started) {
				started.started++
			}
			if (completed && entry.status === 'COMPLETED') {
				completed.completed++
			}
		}

		return points
	}

	const count = range === '6m' ? 6 : 12
	const points: ActivityPoint[] = Array.from({ length: count }, (_, index) => {
		const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
		return { year: date.getFullYear(), month: date.getMonth() + 1, started: 0, completed: 0 }
	})

	const at = (date: TrackerEntry['started_at'] | undefined) =>
		points.find(point => point.year === date?.year && point.month === date?.month)

	for (const entry of unique) {
		const started = at(entry.started_at)
		const completed = at(entry.completed_at)
		if (started) {
			started.started++
		}
		if (completed && entry.status === 'COMPLETED') {
			completed.completed++
		}
	}

	return points
}
