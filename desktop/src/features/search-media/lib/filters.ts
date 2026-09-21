import type { MediaSearchQuery } from '@entities/media'

import { BROWSE_SORT, PER_PAGE } from '../config'
import type { SearchCriteria, SearchFilters } from '../types'

export const INITIAL_FILTERS: SearchFilters = {
	type: 'anime',
	sort: BROWSE_SORT,
	genres: [],
	tags: [],
	formats: [],
	statuses: [],
	season: null,
	year: null,
	minScore: null,
	adult: false
}

export const INITIAL_CRITERIA: SearchCriteria = { title: '', filters: INITIAL_FILTERS }

export function activeGroups(filters: SearchFilters): number {
	return [
		filters.genres.length > 0,
		filters.tags.length > 0,
		filters.formats.length > 0,
		filters.statuses.length > 0,
		filters.season !== null,
		filters.year !== null,
		filters.minScore !== null,
		filters.adult
	].filter(Boolean).length
}

export function applyPatch(filters: SearchFilters, patch: Partial<SearchFilters>): SearchFilters {
	const next = { ...filters, ...patch }

	// A format belongs to one media type, so switching type cannot keep them.
	if (patch.type && patch.type !== filters.type) {
		next.formats = []
	}

	return next
}

export function sameCriteria(a: SearchCriteria, b: SearchCriteria): boolean {
	return a.title.trim() === b.title.trim() && JSON.stringify(a.filters) === JSON.stringify(b.filters)
}

export function requestOf(title: string, filters: SearchFilters, page: number): MediaSearchQuery {
	const query = title.trim()

	return {
		q: query || undefined,
		type: filters.type,
		sort: filters.sort,
		genres: filters.genres.length > 0 ? filters.genres : undefined,
		tags: filters.tags.length > 0 ? filters.tags : undefined,
		formats: filters.formats.length > 0 ? [...filters.formats] : undefined,
		statuses: filters.statuses.length > 0 ? [...filters.statuses] : undefined,
		season: filters.season ?? undefined,
		year: filters.year ?? undefined,
		min_score: filters.minScore ?? undefined,
		adult: filters.adult || undefined,
		page,
		per_page: PER_PAGE
	}
}
