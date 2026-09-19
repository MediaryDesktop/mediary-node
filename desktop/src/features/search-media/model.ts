import { combine, createEvent, createStore, sample } from 'effector'
import { debounce } from 'patronum'

import { atom } from '@shared/factory'

import { mediaFilterOptionsQuery, mediaSearchQuery } from '@entities/media'
import type {
	MediaSearchFormat,
	MediaSearchQuery,
	MediaSearchSeason,
	MediaSearchSort,
	MediaSearchStatus,
	MediaSearchType,
	MediaSummary
} from '@entities/media'

export const SEARCH_TYPES = ['anime', 'manga'] as const satisfies readonly MediaSearchType[]

export const SEARCH_SORTS = [
	'POPULARITY_DESC',
	'SEARCH_MATCH',
	'TRENDING_DESC',
	'SCORE_DESC',
	'FAVOURITES_DESC',
	'START_DATE_DESC',
	'TITLE_ROMAJI'
] as const satisfies readonly MediaSearchSort[]

export const SEARCH_FORMATS = {
	anime: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
	manga: ['MANGA', 'NOVEL', 'ONE_SHOT']
} as const satisfies Record<MediaSearchType, readonly MediaSearchFormat[]>

export const SEARCH_STATUSES = [
	'RELEASING',
	'FINISHED',
	'NOT_YET_RELEASED',
	'HIATUS',
	'CANCELLED'
] as const satisfies readonly MediaSearchStatus[]

export const SEARCH_SEASONS = [
	'WINTER',
	'SPRING',
	'SUMMER',
	'FALL'
] as const satisfies readonly MediaSearchSeason[]

export const SEARCH_SCORES = [90, 80, 70, 60, 50] as const

export const EARLIEST_YEAR = 1940

const PER_PAGE = 30
const CHANGE_PAUSE_MS = 400

const BROWSE_SORT: MediaSearchSort = 'POPULARITY_DESC'
const RELEVANCE_SORT: MediaSearchSort = 'SEARCH_MATCH'

export interface SearchFilters {
	type: MediaSearchType
	sort: MediaSearchSort
	genres: string[]
	tags: string[]
	formats: MediaSearchFormat[]
	statuses: MediaSearchStatus[]
	season: MediaSearchSeason | null
	year: number | null
	minScore: number | null
	adult: boolean
}

const INITIAL_FILTERS: SearchFilters = {
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

function activeGroups(filters: SearchFilters): number {
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

function applyPatch(filters: SearchFilters, patch: Partial<SearchFilters>): SearchFilters {
	const next = { ...filters, ...patch }

	if (patch.type && patch.type !== filters.type) {
		next.formats = []
	}

	return next
}

interface SearchCriteria {
	title: string
	filters: SearchFilters
}

const INITIAL_CRITERIA: SearchCriteria = { title: '', filters: INITIAL_FILTERS }

function sameCriteria(a: SearchCriteria, b: SearchCriteria): boolean {
	return a.title.trim() === b.title.trim() && JSON.stringify(a.filters) === JSON.stringify(b.filters)
}

function requestOf(title: string, filters: SearchFilters, page: number): MediaSearchQuery {
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

export const searchMediaModel = atom(() => {
	const pageOpened = createEvent()
	const titleChanged = createEvent<string>()
	const filtersPatched = createEvent<Partial<SearchFilters>>()
	const filtersCleared = createEvent()
	const filtersToggled = createEvent()
	const nextPageRequested = createEvent()
	const retried = createEvent()
	const pageAdvanced = createEvent()

	const $title = createStore('').on(titleChanged, (_, title) => title)

	const $filters = createStore(INITIAL_FILTERS)
		.on(filtersPatched, applyPatch)
		.on(filtersCleared, filters => ({ ...INITIAL_FILTERS, type: filters.type, sort: filters.sort }))

	const $filtersOpen = createStore(false).on(filtersToggled, open => !open)

	const $activeFilterCount = $filters.map(activeGroups)
	const $titleFilled = $title.map(title => title.trim() !== '')

	sample({
		clock: $titleFilled.updates,
		source: $filters,
		filter: (filters, filled) =>
			filled ? filters.sort === BROWSE_SORT : filters.sort === RELEVANCE_SORT,
		fn: (_, filled) => ({ sort: filled ? RELEVANCE_SORT : BROWSE_SORT }),
		target: filtersPatched
	})

	const $draft = combine({ title: $title, filters: $filters })

	const $criteria = createStore(INITIAL_CRITERIA).on(debounce($draft, CHANGE_PAUSE_MS), (current, draft) =>
		sameCriteria(current, draft) ? current : draft
	)

	const $hasNextPage = mediaSearchQuery.$data.map(data => data?.results.has_next_page ?? false)
	const $filterOptions = mediaFilterOptionsQuery.$data.map(data => data?.options ?? null)

	sample({
		clock: nextPageRequested,
		source: { pending: mediaSearchQuery.$pending, hasNext: $hasNextPage },
		filter: ({ pending, hasNext }) => !pending && hasNext,
		target: pageAdvanced
	})

	const $page = createStore(1)
		.on(pageAdvanced, page => page + 1)
		.reset($criteria.updates)

	const $request = combine($criteria, $page, ({ title, filters }, page) => requestOf(title, filters, page))

	sample({ clock: $request.updates, target: mediaSearchQuery.start })

	sample({
		clock: pageOpened,
		source: $request,
		filter: mediaSearchQuery.$data.map(data => data === null),
		target: mediaSearchQuery.start
	})

	sample({ clock: retried, source: $request, target: mediaSearchQuery.start })

	sample({
		clock: pageOpened,
		filter: mediaFilterOptionsQuery.$data.map(options => options === null),
		target: mediaFilterOptionsQuery.start
	})

	const $items = createStore<MediaSummary[]>([]).on(
		mediaSearchQuery.finished.success,
		(items, { params, result }) => {
			const page = result.results.items ?? []

			return (params.page ?? 1) > 1 ? [...items, ...page] : page
		}
	)

	const $loadingFirstPage = combine(
		mediaSearchQuery.$pending,
		$page,
		(pending, page) => pending && page === 1
	)

	const $loadingMore = combine(mediaSearchQuery.$pending, $page, (pending, page) => pending && page > 1)

	const $failed = combine(
		mediaSearchQuery.$error,
		mediaSearchQuery.$pending,
		$page,
		(error, pending, page) => error !== null && !pending && page === 1
	)

	const $loadMoreFailed = combine(
		mediaSearchQuery.$error,
		mediaSearchQuery.$pending,
		$page,
		(error, pending, page) => error !== null && !pending && page > 1
	)

	return {
		$title,
		$filters,
		$filtersOpen,
		$activeFilterCount,
		$filterOptions,
		$items,
		$hasNextPage,
		$loadingFirstPage,
		$loadingMore,
		$failed,
		$loadMoreFailed,
		pageOpened,
		titleChanged,
		filtersPatched,
		filtersCleared,
		filtersToggled,
		nextPageRequested,
		retried
	}
})
