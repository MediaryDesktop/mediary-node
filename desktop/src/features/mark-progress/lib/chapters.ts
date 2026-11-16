import type { TrackerEntryPatch } from '@entities/tracker'

export function readProgress(number: string | null, read: boolean, progress: number): number | null {
	if (number === null || !/^\d+$/.test(number)) {
		return null
	}

	const value = Number(number)
	if (value <= 0) {
		return null
	}

	const next = read ? Math.max(progress, value) : Math.min(progress, value - 1)

	return next === progress ? null : next
}

// What marking a chapter read or unread writes to the tracker. A title not on
// any list yet is put on "reading" with it: marking a chapter is starting it.
export function readProgressPatch(
	number: string | null,
	read: boolean,
	{ progress, listed }: { progress: number; listed: boolean }
): TrackerEntryPatch | null {
	const next = readProgress(number, read, progress)

	if (next === null) {
		return null
	}

	return listed ? { progress: next } : { status: 'CURRENT', progress: next }
}
