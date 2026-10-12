import type { MediaSearchQuery, MediaSearchType } from '@entities/media'

import { BROWSE_SORT, isAniListType, PER_PAGE } from '../config/config'
import type { SearchCriteria, SearchFilters } from '../model/types'

export const INITIAL_FILTERS: SearchFilters = {
	type: 'series',
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

// Which genre list a type draws from: AniList shares one between anime and manga,
// TMDB keeps one for movies and another for shows, books have their own.
function genreVocabulary(type: MediaSearchType): string {
	if (isAniListType(type)) {
		return 'anilist'
	}

	if (type === 'book') {
		return 'books'
	}

	return type === 'movie' ? 'tmdb-movie' : 'tmdb-tv'
}

export function applyPatch(filters: SearchFilters, patch: Partial<SearchFilters>): SearchFilters {
	const next = { ...filters, ...patch }

	if (!patch.type || patch.type === filters.type) {
		return next
	}

	// A format belongs to one media type, so switching type cannot keep them.
	next.formats = []

	if (genreVocabulary(patch.type) !== genreVocabulary(filters.type)) {
		next.genres = []
	}

	if (!isAniListType(patch.type)) {
		next.tags = []
		next.statuses = []
		next.season = null
	}

	return next
}

export function sameCriteria(a: SearchCriteria, b: SearchCriteria): boolean {
	return a.title.trim() === b.title.trim() && JSON.stringify(a.filters) === JSON.stringify(b.filters)
}

export function requestOf(title: string, filters: SearchFilters, page: number): MediaSearchQuery {
	const query = title.trim()
	const aniList = isAniListType(filters.type)

	return {
		q: query || undefined,
		type: filters.type,
		sort: filters.sort,
		genres: filters.genres.length > 0 ? filters.genres : undefined,
		tags: aniList && filters.tags.length > 0 ? filters.tags : undefined,
		formats: aniList && filters.formats.length > 0 ? [...filters.formats] : undefined,
		statuses: aniList && filters.statuses.length > 0 ? [...filters.statuses] : undefined,
		season: aniList ? (filters.season ?? undefined) : undefined,
		year: filters.year ?? undefined,
		min_score: filters.minScore ?? undefined,
		adult: filters.adult || undefined,
		page,
		per_page: PER_PAGE
	}
}
