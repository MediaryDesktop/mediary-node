import type { TorrentRelease } from '@entities/torrent'

export type ReleaseSortField = 'seeders' | 'size' | 'date' | 'resolution'
export type ReleaseSortDirection = 'asc' | 'desc'

export interface ReleaseSort {
	field: ReleaseSortField | null
	direction: ReleaseSortDirection
}

export const SORT_FIELDS: readonly ReleaseSortField[] = ['seeders', 'size', 'date', 'resolution']

// No field keeps the node's own order: it ranks by the release profile, and
// that order is the one worth seeing first.
export const UNSORTED: ReleaseSort = { field: null, direction: 'desc' }

// A newly picked field starts largest first: most seeders, the biggest file,
// the newest, the sharpest.
export function sortBy(field: ReleaseSortField | null): ReleaseSort {
	return { field, direction: 'desc' }
}

export function flipSort(sort: ReleaseSort): ReleaseSort {
	return { ...sort, direction: sort.direction === 'desc' ? 'asc' : 'desc' }
}

export function sortReleases(releases: readonly TorrentRelease[], sort: ReleaseSort): TorrentRelease[] {
	const field = sort.field
	if (!field) {
		return [...releases]
	}

	const sign = sort.direction === 'asc' ? 1 : -1

	return [...releases].sort((a, b) => sign * (valueOf(a, field) - valueOf(b, field)))
}

function valueOf(release: TorrentRelease, field: ReleaseSortField): number {
	switch (field) {
		case 'seeders':
			return release.seeders
		case 'size':
			return release.size
		case 'date':
			return release.published_at ? new Date(release.published_at).getTime() || 0 : 0
		case 'resolution':
			return resolutionLines(release.resolution)
	}
}

export function resolutionLines(resolution: string | null | undefined): number {
	return Number.parseInt(resolution ?? '', 10) || 0
}

export function parseSort(stored: string | null): ReleaseSort {
	const [field, direction] = (stored ?? '').split(':')

	if (!SORT_FIELDS.includes(field as ReleaseSortField)) {
		return UNSORTED
	}

	return {
		field: field as ReleaseSortField,
		direction: direction === 'asc' ? 'asc' : 'desc'
	}
}

export function formatSort(sort: ReleaseSort): string {
	return sort.field ? `${sort.field}:${sort.direction}` : ''
}
