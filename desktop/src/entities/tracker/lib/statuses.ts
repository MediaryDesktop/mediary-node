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

const STATUS_LIST_PREFIX = 'status:'

// Every title of one status opens like a list of its own, next to the user's
// lists; its id is the status behind a prefix no list id has.
export function statusListId(status: TrackerStatus): string {
	return STATUS_LIST_PREFIX + status
}

export function statusOfListId(listId: string): TrackerStatus | null {
	if (!listId.startsWith(STATUS_LIST_PREFIX)) {
		return null
	}

	const status = listId.slice(STATUS_LIST_PREFIX.length)

	return isTrackerStatus(status) ? status : null
}
