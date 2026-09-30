import type { LibraryScan, ScanActivity, ScanPhase } from '@entities/library-item'

export const PHASE_LABELS = {
	scanning: 'library.scan.walking',
	probing: 'library.scan.probing',
	matching: 'library.scan.matching'
} as const satisfies Record<ScanPhase, string>

// What the bar measures depends on the phase: folders while it walks them, then
// files while it reads their containers, then titles while it matches them.
export function progressOf(activity: ScanActivity | null, scan: LibraryScan | null): number | null {
	if (activity === null) {
		return scan?.finished_at ? 100 : null
	}

	const [value, max] =
		activity.phase === 'scanning'
			? [activity.rootsDone, activity.rootsTotal]
			: [activity.done, activity.total]

	return max > 0 ? Math.round((Math.min(value, max) / max) * 100) : null
}
