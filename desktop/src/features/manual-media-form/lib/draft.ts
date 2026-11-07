import type { ManualDraft, MediaDetails, MediaSearchType } from '@entities/media'

export type ManualMediaType = MediaSearchType

export const MANUAL_MEDIA_TYPES: readonly ManualMediaType[] = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama',
	'book'
]

export const MANUAL_FORMATS: Record<ManualMediaType, NonNullable<ManualDraft['format']>[]> = {
	anime: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
	manga: ['MANGA', 'NOVEL', 'ONE_SHOT'],
	movie: ['MOVIE'],
	series: ['TV'],
	dorama: ['TV'],
	book: ['BOOK']
}

export const MANUAL_STATUSES: NonNullable<ManualDraft['status']>[] = [
	'FINISHED',
	'RELEASING',
	'NOT_YET_RELEASED',
	'CANCELLED',
	'HIATUS'
]

export function isManualMediaType(value: unknown): value is ManualMediaType {
	return typeof value === 'string' && (MANUAL_MEDIA_TYPES as readonly string[]).includes(value)
}

export function isManualRef(mediaRef: string): boolean {
	return mediaRef.startsWith('manual:')
}

export function manualId(mediaRef: string): string {
	return mediaRef.slice('manual:'.length)
}

export function emptyManualDraft(mediaType: ManualMediaType, title: string): ManualDraft {
	return { media_type: mediaType, title }
}

export function draftFromDetails(media: MediaDetails): ManualDraft {
	return {
		media_type: media.media_type as ManualMediaType,
		title: media.title.user_preferred ?? media.title.english ?? '',
		original_title: media.title.native ?? undefined,
		synonyms: media.synonyms ?? undefined,
		description: media.description || undefined,
		format: (media.format ?? undefined) as ManualDraft['format'],
		status: (media.status ?? undefined) as ManualDraft['status'],
		year: media.start_date.year ?? undefined,
		end_year: media.end_date.year ?? undefined,
		score: media.average_score ?? undefined,
		seasons: media.seasons ?? undefined,
		episodes: media.episodes ?? undefined,
		chapters: media.chapters ?? undefined,
		volumes: media.volumes ?? undefined,
		pages: media.pages ?? undefined,
		duration: media.duration ?? undefined,
		genres: media.genres ?? undefined,
		studios: media.studios ?? undefined,
		authors: media.authors ?? undefined,
		country_of_origin: media.country_of_origin ?? undefined,
		is_adult: media.is_adult
	}
}

export function formatAfterTypeChange(
	type: ManualMediaType,
	format: ManualDraft['format']
): ManualDraft['format'] {
	return format && MANUAL_FORMATS[type].includes(format) ? format : undefined
}

export function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true
	}

	if (typeof value === 'string') {
		return value.trim() === ''
	}

	if (Array.isArray(value)) {
		return value.length === 0
	}

	return false
}
