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

function isEmptyValue(value: unknown): boolean {
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

const AI_MERGE_FIELDS = [
	'original_title',
	'synonyms',
	'description',
	'format',
	'status',
	'year',
	'end_year',
	'seasons',
	'episodes',
	'chapters',
	'volumes',
	'pages',
	'duration',
	'genres',
	'studios',
	'authors',
	'country_of_origin'
] as const satisfies readonly (keyof ManualDraft)[]

export type AiMergeField = (typeof AI_MERGE_FIELDS)[number]

export interface MergeResult {
	draft: ManualDraft
	filled: Set<AiMergeField>
}

export function withoutAiFilled(draft: ManualDraft, aiFilled: ReadonlySet<AiMergeField>): ManualDraft {
	const own: Record<string, unknown> = { ...draft }

	for (const field of aiFilled) {
		own[field] = Array.isArray(draft[field]) ? [] : undefined
	}

	return own as ManualDraft
}

export function mergeSuggestion(
	draft: ManualDraft,
	suggested: ManualDraft,
	aiFilled: ReadonlySet<AiMergeField> = new Set()
): MergeResult {
	const own = withoutAiFilled(draft, aiFilled)
	const next: Record<string, unknown> = { ...own }
	const filled = new Set<AiMergeField>()

	for (const field of AI_MERGE_FIELDS) {
		if (!isEmptyValue(own[field])) {
			continue
		}

		const value = suggested[field]
		if (isEmptyValue(value)) {
			continue
		}

		next[field] = value
		filled.add(field)
	}

	return { draft: next as ManualDraft, filled }
}

export function dateFromParts(year?: number, month?: number, day?: number): string {
	if (!year || !month || !day) {
		return ''
	}

	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface DateParts {
	year?: number
	month?: number
	day?: number
}

export function partsFromDate(value: string): DateParts {
	const [year, month, day] = value.split('-').map(Number)

	if (!year || !month || !day) {
		return {}
	}

	return { year, month, day }
}

export const COMMON_COUNTRIES = [
	'JP',
	'KR',
	'CN',
	'TW',
	'US',
	'GB',
	'FR',
	'DE',
	'IT',
	'ES',
	'CA',
	'AU',
	'IN',
	'TH',
	'RU',
	'BR',
	'MX',
	'NL',
	'PL',
	'SE'
]

export function flagEmoji(code: string): string {
	return [...code.toUpperCase()].map(char => String.fromCodePoint(127_397 + char.charCodeAt(0))).join('')
}

export function mainCountField(mediaType: ManualMediaType): keyof ManualDraft | null {
	switch (mediaType) {
		case 'manga':
			return 'chapters'
		case 'book':
			return 'pages'
		case 'movie':
			return 'duration'
		default:
			return 'episodes'
	}
}

export interface CompletenessTier {
	filled: number
	total: number
}

export interface Completeness {
	required: CompletenessTier
	recommended: CompletenessTier
	additional: CompletenessTier
}

export type CompletenessField = keyof ManualDraft | 'cover'

export interface CompletenessFields {
	required: CompletenessField[]
	recommended: CompletenessField[]
	additional: CompletenessField[]
}

export function completenessFields(mediaType: ManualMediaType): CompletenessFields {
	const main = mainCountField(mediaType) ?? 'duration'
	const credits = mediaType === 'manga' || mediaType === 'book' ? 'authors' : 'studios'

	const additional: CompletenessField[] = [
		'original_title',
		'synonyms',
		credits,
		'score',
		'country_of_origin',
		'end_year'
	]

	if (mediaType === 'manga') {
		additional.push('volumes')
	} else if (mediaType !== 'movie' && mediaType !== 'book') {
		additional.push('seasons')
	}

	return {
		required: ['title', 'media_type', 'year', 'status'],
		recommended: ['format', 'genres', 'description', 'cover', main],
		additional
	}
}

export function fieldFilled(
	draft: ManualDraft,
	field: CompletenessField,
	hasCover: boolean,
	typePicked = true
): boolean {
	if (field === 'cover') {
		return hasCover
	}

	if (field === 'media_type' && !typePicked) {
		return false
	}

	return !isEmptyValue(draft[field])
}

export function completeness(draft: ManualDraft, hasCover: boolean, typePicked = true): Completeness {
	const fields = completenessFields(draft.media_type)

	const tier = (list: CompletenessField[]): CompletenessTier => ({
		filled: list.filter(field => fieldFilled(draft, field, hasCover, typePicked)).length,
		total: list.length
	})

	return {
		required: tier(fields.required),
		recommended: tier(fields.recommended),
		additional: tier(fields.additional)
	}
}

export function formatAfterTypeChange(
	type: ManualMediaType,
	format: ManualDraft['format']
): ManualDraft['format'] {
	return format && MANUAL_FORMATS[type].includes(format) ? format : undefined
}

export function hintNote(draft: ManualDraft): string {
	const parts: string[] = []

	if (draft.original_title) {
		parts.push(draft.original_title)
	}

	if (draft.synonyms && draft.synonyms.length > 0) {
		parts.push(draft.synonyms.join(', '))
	}

	const credits =
		draft.media_type === 'manga' || draft.media_type === 'book' ? draft.authors : draft.studios
	if (credits && credits.length > 0) {
		parts.push(credits.join(', '))
	}

	if (draft.country_of_origin) {
		parts.push(draft.country_of_origin)
	}

	return parts.join('; ')
}
