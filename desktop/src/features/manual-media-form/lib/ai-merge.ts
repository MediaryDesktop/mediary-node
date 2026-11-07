import type { ManualDraft } from '@entities/media'

import { isEmptyValue } from './draft'

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
