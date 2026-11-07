import type { ManualDraft } from '@entities/media'

import { isEmptyValue } from './draft'
import type { ManualMediaType } from './draft'

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
