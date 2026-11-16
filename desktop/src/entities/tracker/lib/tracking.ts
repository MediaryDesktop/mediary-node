import type { TFunction } from 'i18next'

import type { TrackerEntry } from '../api/api'

export interface EntryTracking {
	status: string
	statusLabel: string
	score: number
	genres: string[] | null
	year: number | null
	mediaType: string
	progress: number
	total: number | null
}

export function entryTracking(entry: TrackerEntry, t: TFunction): EntryTracking {
	return {
		status: entry.status,
		statusLabel: t(`lists.status.${entry.media_type}.${entry.status}` as never) as string,
		score: entry.score,
		genres: entry.media.genres,
		year: entry.media.season_year,
		mediaType: entry.media_type,
		progress: entry.progress,
		total: entry.media.episodes ?? entry.media.chapters ?? null
	}
}
