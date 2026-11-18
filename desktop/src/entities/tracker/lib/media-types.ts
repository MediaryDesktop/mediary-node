import type { TrackerMediaType } from '../api/api'

export const TRACKER_MEDIA_TYPES = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama',
	'book'
] as const satisfies readonly TrackerMediaType[]

export function isTrackerMediaType(value: string): value is TrackerMediaType {
	return (TRACKER_MEDIA_TYPES as readonly string[]).includes(value)
}

// Anime and manga are tracked on AniList; every other type lives on the node itself.
export function isLocalTrackerType(mediaType: TrackerMediaType): boolean {
	return mediaType !== 'anime' && mediaType !== 'manga'
}

export function canTrack(mediaType: string, aniListConnected: boolean): mediaType is TrackerMediaType {
	return isTrackerMediaType(mediaType) && (aniListConnected || isLocalTrackerType(mediaType))
}
