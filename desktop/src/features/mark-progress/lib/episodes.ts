import type { TrackerEntryPatch } from '@entities/tracker'

// Episode numbers past this are the order's stand-ins for episodes the title's
// own list does not know, not numbers the user's list could hold.
const LISTED_LIMIT = 100_000

// Whether an episode's number is one the user's list counts in.
export function listableEpisode(number: number | null): number is number {
	return number !== null && Number.isInteger(number) && number > 0 && number < LISTED_LIMIT
}

// What marking an episode watched or not writes to the tracker, the way
// marking a chapter does: watched raises the list to it, unwatched lowers the
// list below it, since everything up to the list's number counts as watched.
// A title not on any list yet is put on "watching" with it.
export function watchedProgressPatch(
	number: number,
	watched: boolean,
	{ progress, listed }: { progress: number; listed: boolean }
): TrackerEntryPatch | null {
	const next = watched ? Math.max(progress, number) : Math.min(progress, number - 1)

	if (next === progress) {
		return null
	}

	return listed ? { progress: next } : { status: 'CURRENT', progress: next }
}
