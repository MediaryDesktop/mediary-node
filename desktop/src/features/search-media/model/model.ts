import { combine, createEvent, createStore, sample } from 'effector'
import { debounce } from 'patronum'

import { setupRequired } from '@shared/api'
import { atom } from '@shared/factory'

import { mediaFilterOptionsQuery, mediaSearchQuery } from '@entities/media'
import type { MediaSearchType, MediaSummary } from '@entities/media'

import { BROWSE_SORT, CHANGE_PAUSE_MS, RELEVANCE_SORT } from '../config/config'
import {
	activeGroups,
	applyPatch,
	INITIAL_CRITERIA,
	INITIAL_FILTERS,
	requestOf,
	sameCriteria
} from '../lib/filters'

import type { SearchFilters } from './types'

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

	const $type = $filters.map(filters => filters.type)
	const $optionsType = createStore<MediaSearchType | null>(null).on(
		mediaFilterOptionsQuery.finished.success,
		(_, { params }) => params
	)

	const $filterOptions = combine(
		mediaFilterOptionsQuery.$data,
		$optionsType,
		$type,
		(data, optionsType, type) => (optionsType === type ? (data?.options ?? null) : null)
	)

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
		source: { type: $type, optionsType: $optionsType },
		filter: ({ type, optionsType }) => type !== optionsType,
		fn: ({ type }) => type,
		target: mediaFilterOptionsQuery.start
	})

	sample({ clock: $type.updates, target: mediaFilterOptionsQuery.start })

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

	const $setupNeeded = mediaSearchQuery.$error.map(error => setupRequired(error))

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
		$setupNeeded,
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
