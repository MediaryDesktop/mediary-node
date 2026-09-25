import type { TFunction } from 'i18next'

import type { TrackerEntry } from '../api/api'

export interface EntryTracking {
	statusLabel: string
	score: number
	genres: string[] | null
	year: number | null
}

export function entryTracking(entry: TrackerEntry, t: TFunction): EntryTracking {
	return {
		statusLabel: t(`lists.status.${entry.media_type}.${entry.status}` as never) as string,
		score: entry.score,
		genres: entry.media.genres,
		year: entry.media.season_year
	}
}
