import type { TorrentRelease } from '@entities/torrent'

import { resolutionLines } from './sort'

export type QuickFilter = 'best' | 'hd' | 'seeded'

export const QUICK_FILTERS: readonly QuickFilter[] = ['best', 'hd', 'seeded']

// The one-click narrowing above the results; each filter on keeps only the
// releases that pass it, so two on means both.
export function applyQuickFilters(
	releases: readonly TorrentRelease[],
	on: ReadonlySet<QuickFilter>
): TorrentRelease[] {
	return releases.filter(release => {
		if (on.has('best') && !release.best) return false
		if (on.has('hd') && resolutionLines(release.resolution) < 1080) return false
		if (on.has('seeded') && release.seeders < 1) return false
		return true
	})
}

export function toggleQuickFilter(on: ReadonlySet<QuickFilter>, filter: QuickFilter): Set<QuickFilter> {
	const next = new Set(on)

	if (next.has(filter)) {
		next.delete(filter)
	} else {
		next.add(filter)
	}

	return next
}
