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

// The format vocabulary each kind may be given, the same the node accepts — a
// movie cannot come back as an OVA.
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

// The reverse of the node's own manualDetails(): rebuilds the draft a saved
// title was made from, so editing starts from what is actually stored.
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

// Claude answers from the hint alone, with no memory of what else the user
// already typed — every field it fills in is merged in here, and only where
// the user's own draft was still empty (or held only an earlier AI answer).
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

// What the user themselves typed: a value the AI filled in and the user has not
// touched since is its guess, not their word, so it neither goes into the next
// request nor stops the next answer from replacing it.
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

// A date field split across three numbers, as ManualDraft stores it, parsed
// to and from the YYYY-MM-DD string DatePicker takes.
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

// A handful of countries a title commonly comes from — enough to cover anime,
// manga and manhwa/manhua at a glance, plus the biggest film and TV markets.
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

// A 2-letter code to its flag, by the same trick every flag emoji uses: each
// letter maps to the regional indicator symbol at the same offset as 'A'.
export function flagEmoji(code: string): string {
	return [...code.toUpperCase()].map(char => String.fromCodePoint(127_397 + char.charCodeAt(0))).join('')
}

// The one count that matters most for a kind of title — what its progress bar
// elsewhere in the app counts against.
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

// What completeness counts: a handful of fields no title should miss, a few
// that make it easier to find and browse, and the rest — each only as useful
// as the one before it, never required to save.
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

// Before the kind is picked the draft carries a placeholder one, which must
// not count as the user's answer.
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

// The format a draft keeps after its kind changes: a book cannot stay an OVA,
// and the node refuses the pair, so the stale one is dropped.
export function formatAfterTypeChange(
	type: ManualMediaType,
	format: ManualDraft['format']
): ManualDraft['format'] {
	return format && MANUAL_FORMATS[type].includes(format) ? format : undefined
}

// What tells Claude apart one same-named title from another, built from
// whatever the user already filled in rather than a note field of its own.
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
