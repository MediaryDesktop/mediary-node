import { useState } from 'react'

import { readStored, writeStored } from '@shared/lib'

import { flipSort, formatSort, parseSort, sortBy } from './sort'
import type { ReleaseSort, ReleaseSortField } from './sort'

const SORT_KEY = 'mediary.torrents.releaseSort'

export interface ReleaseSortControl {
	sort: ReleaseSort
	pick: (field: ReleaseSortField | null) => void
	flip: () => void
}

// The order is a habit, not a choice per title, so it outlives the drawer.
export function useReleaseSort(): ReleaseSortControl {
	const [sort, setSort] = useState(() => parseSort(readStored(SORT_KEY)))

	const save = (next: ReleaseSort) => {
		writeStored(SORT_KEY, formatSort(next))
		setSort(next)
	}

	return {
		sort,
		pick: field => save(sortBy(field)),
		flip: () => save(flipSort(sort))
	}
}
