import type {
	ManualMediaDraft,
	ManualMediaFormat,
	ManualMediaStatus,
	ManualMediaType,
	MediaDetails
} from '@entities/media'

export const MANUAL_MEDIA_TYPES = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama',
	'book'
] as const satisfies readonly ManualMediaType[]

// The first is what the node picks when the form leaves the format out.
export const MANUAL_FORMATS: Record<ManualMediaType, readonly ManualMediaFormat[]> = {
	anime: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
	manga: ['MANGA', 'NOVEL', 'ONE_SHOT'],
	movie: ['MOVIE'],
	series: ['TV'],
	dorama: ['TV'],
	book: ['BOOK']
}

export const MANUAL_STATUSES = [
	'FINISHED',
	'RELEASING',
	'NOT_YET_RELEASED',
	'CANCELLED',
	'HIATUS'
] as const satisfies readonly ManualMediaStatus[]

export type ManualCountField = 'episodes' | 'chapters' | 'volumes' | 'pages' | 'duration'

// What progress counts for each kind, and the length of an episode where there is
// one; the node drops whatever else the form carries.
export const MANUAL_COUNTS: Record<ManualMediaType, readonly ManualCountField[]> = {
	anime: ['episodes', 'duration'],
	manga: ['chapters', 'volumes'],
	movie: ['duration'],
	series: ['episodes', 'duration'],
	dorama: ['episodes', 'duration'],
	book: ['pages']
}

export interface ManualMediaForm {
	mediaType: ManualMediaType
	title: string
	originalTitle: string
	synonyms: string
	description: string
	format: ManualMediaFormat | null
	status: ManualMediaStatus | null
	year: string
	episodes: string
	chapters: string
	volumes: string
	pages: string
	duration: string
	genres: string
	studios: string
	authors: string
}

export type ManualMediaField = keyof ManualMediaForm

export type ManualMediaError = 'year' | 'count' | 'duration'

const MIN_YEAR = 1800
const MAX_YEAR = 2100
const MAX_COUNT = 100_000
const MAX_DURATION = 1000

export function emptyForm(mediaType: ManualMediaType, title = ''): ManualMediaForm {
	return {
		mediaType,
		title,
		originalTitle: '',
		synonyms: '',
		description: '',
		format: null,
		status: null,
		year: '',
		episodes: '',
		chapters: '',
		volumes: '',
		pages: '',
		duration: '',
		genres: '',
		studios: '',
		authors: ''
	}
}

export function isManualMediaType(value: string): value is ManualMediaType {
	return (MANUAL_MEDIA_TYPES as readonly string[]).includes(value)
}

function countText(value: number | null | undefined): string {
	return value == null ? '' : String(value)
}

export function formFromMedia(media: MediaDetails): ManualMediaForm {
	const mediaType = isManualMediaType(media.media_type) ? media.media_type : 'anime'
	const formats = MANUAL_FORMATS[mediaType]
	const format = formats.find(candidate => candidate === media.format) ?? null
	const status = MANUAL_STATUSES.find(candidate => candidate === media.status) ?? null

	return {
		mediaType,
		title: media.title.user_preferred ?? media.title.english ?? '',
		originalTitle: media.title.native ?? '',
		synonyms: (media.synonyms ?? []).join('\n'),
		description: media.description,
		format,
		status,
		year: countText(media.season_year),
		episodes: mediaType === 'movie' ? '' : countText(media.episodes),
		chapters: countText(media.chapters),
		volumes: countText(media.volumes),
		pages: countText(media.pages),
		duration: countText(media.duration),
		genres: (media.genres ?? []).join(', '),
		studios: (media.studios ?? []).join(', '),
		authors: (media.authors ?? []).join(', ')
	}
}

// Synonyms are one per line: a title may have a comma in it, a genre may not.
function lines(text: string): string[] {
	return text
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
}

function commaList(text: string): string[] {
	return text
		.split(',')
		.map(item => item.trim())
		.filter(Boolean)
}

function wholeNumber(text: string): number | null {
	const trimmed = text.trim()

	return /^\d+$/.test(trimmed) ? Number(trimmed) : null
}

export function formErrors(form: ManualMediaForm): Partial<Record<ManualMediaField, ManualMediaError>> {
	const errors: Partial<Record<ManualMediaField, ManualMediaError>> = {}

	if (form.year.trim() !== '') {
		const year = wholeNumber(form.year)

		if (year === null || year < MIN_YEAR || year > MAX_YEAR) {
			errors.year = 'year'
		}
	}

	for (const field of MANUAL_COUNTS[form.mediaType]) {
		if (form[field].trim() === '') {
			continue
		}

		const value = wholeNumber(form[field])
		const limit = field === 'duration' ? MAX_DURATION : MAX_COUNT

		if (value === null || value > limit) {
			errors[field] = field === 'duration' ? 'duration' : 'count'
		}
	}

	return errors
}

export function canSubmitForm(form: ManualMediaForm): boolean {
	return form.title.trim() !== '' && Object.keys(formErrors(form)).length === 0
}

// Only what the kind of title has goes out, and nothing the user left empty: the
// node keeps an absent field absent rather than zero.
export function draftFromForm(form: ManualMediaForm): ManualMediaDraft {
	const draft: ManualMediaDraft = {
		media_type: form.mediaType,
		title: form.title.trim()
	}

	const originalTitle = form.originalTitle.trim()
	if (originalTitle) {
		draft.original_title = originalTitle
	}

	const description = form.description.trim()
	if (description) {
		draft.description = description
	}

	if (form.format && MANUAL_FORMATS[form.mediaType].includes(form.format)) {
		draft.format = form.format
	}

	if (form.status) {
		draft.status = form.status
	}

	const year = wholeNumber(form.year)
	if (year !== null) {
		draft.year = year
	}

	for (const field of MANUAL_COUNTS[form.mediaType]) {
		const value = wholeNumber(form[field])

		if (value !== null && value > 0) {
			draft[field] = value
		}
	}

	const synonyms = lines(form.synonyms)
	if (synonyms.length > 0) {
		draft.synonyms = synonyms
	}

	const genres = commaList(form.genres)
	if (genres.length > 0) {
		draft.genres = genres
	}

	const studios = commaList(form.studios)
	if (studios.length > 0 && hasStudios(form.mediaType)) {
		draft.studios = studios
	}

	const authors = commaList(form.authors)
	if (authors.length > 0 && hasAuthors(form.mediaType)) {
		draft.authors = authors
	}

	return draft
}

export function hasAuthors(mediaType: ManualMediaType): boolean {
	return mediaType === 'manga' || mediaType === 'book'
}

export function hasStudios(mediaType: ManualMediaType): boolean {
	return !hasAuthors(mediaType)
}
