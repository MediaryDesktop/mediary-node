import type { TrackerEntryPatch } from '../api/api'

export type TrackerStatus = NonNullable<TrackerEntryPatch['status']>

export const TRACKER_STATUSES = [
	'CURRENT',
	'PLANNING',
	'COMPLETED',
	'PAUSED',
	'DROPPED',
	'REPEATING'
] as const satisfies readonly TrackerStatus[]

export function isTrackerStatus(value: string): value is TrackerStatus {
	return (TRACKER_STATUSES as readonly string[]).includes(value)
}
