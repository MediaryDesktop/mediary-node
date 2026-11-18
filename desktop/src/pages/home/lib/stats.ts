import { isVideoMedia } from '@entities/media'
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

const TOP_RATED = 5

export function emptyCounts(): StatusCounts {
	return Object.fromEntries(TRACKER_STATUSES.map(status => [status, 0])) as StatusCounts
}

function uniqueEntries(entries: TrackerEntry[]): TrackerEntry[] {
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

		if (isVideoMedia(entry.media_type)) {
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

type EntryDate = TrackerEntry['started_at'] | undefined

interface Timeline {
	points: ActivityPoint[]
	at: (date: EntryDate) => ActivityPoint | undefined
}

// One point a year, from the first year any entry was started or completed in.
function yearly(entries: TrackerEntry[], now: Date): Timeline | null {
	const years = entries.flatMap(entry =>
		[entry.started_at?.year, entry.completed_at?.year].filter((year): year is number => year != null)
	)
	if (years.length === 0) {
		return null
	}

	const first = Math.min(...years)
	const points = Array.from({ length: now.getFullYear() - first + 1 }, (_, index) => ({
		year: first + index,
		month: null,
		started: 0,
		completed: 0
	}))

	return { points, at: date => points.find(point => point.year === date?.year) }
}

// One point a month for the last `count` months, this one included.
function monthly(count: number, now: Date): Timeline {
	const points: ActivityPoint[] = Array.from({ length: count }, (_, index) => {
		const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
		return { year: date.getFullYear(), month: date.getMonth() + 1, started: 0, completed: 0 }
	})

	return {
		points,
		at: date => points.find(point => point.year === date?.year && point.month === date?.month)
	}
}

// How many titles were started and completed in each period of the range.
export function activity(entries: TrackerEntry[], range: ActivityRange, now = new Date()): ActivityPoint[] {
	const unique = uniqueEntries(entries)
	const timeline = range === 'all' ? yearly(unique, now) : monthly(range === '6m' ? 6 : 12, now)

	if (!timeline) {
		return []
	}

	for (const entry of unique) {
		const started = timeline.at(entry.started_at)
		const completed = timeline.at(entry.completed_at)
		if (started) {
			started.started++
		}
		if (completed && entry.status === 'COMPLETED') {
			completed.completed++
		}
	}

	return timeline.points
}
