import type { MediaSummary } from '@entities/media'
import type { ListMediaType, TrackerCustomList } from '@entities/tracker'

export type ListsFilter = ListMediaType | 'all'

export const LIST_SORTS = ['recent', 'name', 'size'] as const

export type ListsSort = (typeof LIST_SORTS)[number]

function changedAt(list: TrackerCustomList): number {
	return list.updated_at ? Date.parse(list.updated_at) : 0
}

function matchesSearch(name: string, search: string): boolean {
	const needle = search.trim().toLowerCase()

	return needle === '' || name.toLowerCase().includes(needle)
}

// The lists of the picked type whose name has the search in it, in the chosen
// order: the most recently changed first, by name, or the biggest first.
export function visibleLists(
	lists: TrackerCustomList[],
	{ filter, search, sort }: { filter: ListsFilter; search: string; sort: ListsSort }
): TrackerCustomList[] {
	const matched = lists.filter(
		list => (filter === 'all' || list.media_type === filter) && matchesSearch(list.name, search)
	)

	switch (sort) {
		case 'name':
			return matched.sort((a, b) => a.name.localeCompare(b.name))
		case 'size':
			return matched.sort((a, b) => b.count - a.count)
		default:
			return matched.sort((a, b) => changedAt(b) - changedAt(a))
	}
}

export interface MyTitlesCard {
	name: string
	count: number
	covers: string[]
}

// "My titles" is a list of its own on this page. Under a type filter it shows
// only when the user described a title of that type; the search matches its name.
export function myTitlesCard(
	titles: MediaSummary[],
	{ filter, search, name }: { filter: ListsFilter; search: string; name: string }
): MyTitlesCard | null {
	const ofFilter = filter === 'all' ? titles : titles.filter(title => title.media_type === filter)

	if ((filter !== 'all' && ofFilter.length === 0) || !matchesSearch(name, search)) {
		return null
	}

	return {
		name,
		count: ofFilter.length,
		covers: ofFilter.flatMap(title => (title.cover_image ? [title.cover_image] : []))
	}
}

export type ListsPhase = 'lists' | 'loading' | 'failed' | 'empty' | 'idle'

// What the page shows. Lists already on screen stay there through a refetch
// or a failed one; "loading" and "failed" are only for a page with nothing yet.
export function listsPhase({
	shown,
	known,
	pending,
	failed
}: {
	shown: boolean
	known: boolean
	pending: boolean
	failed: boolean
}): ListsPhase {
	if (shown) {
		return 'lists'
	}

	if (pending && !known) {
		return 'loading'
	}

	if (failed && !known) {
		return 'failed'
	}

	if (!pending && !failed) {
		return 'empty'
	}

	return 'idle'
}
