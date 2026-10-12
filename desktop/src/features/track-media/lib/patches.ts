import type { TrackerEntry, TrackerEntryPatch, TrackerMediaType, TrackerStatus } from '@entities/tracker'

import { dateToInput, inputToDate } from './entry-dates'

export function sameLists(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every(name => right.includes(name))
}

// What the list drawer changes: the status and the custom lists. A title that is not
// on any list yet (entry null) is added with whatever the drawer says. Starting or
// finishing a title stamps today's date where none was set.
export function managePatch(
	entry: TrackerEntry | null,
	status: TrackerStatus,
	lists: string[],
	today: string
): TrackerEntryPatch {
	const patch: TrackerEntryPatch = {}

	if (!entry || entry.status !== status) {
		patch.status = status

		if (!entry?.started_at?.year && (status === 'CURRENT' || status === 'COMPLETED')) {
			patch.started_at = inputToDate(today)
		}

		if (!entry?.completed_at?.year && status === 'COMPLETED') {
			patch.completed_at = inputToDate(today)
		}
	}

	if (!sameLists(entry?.custom_lists ?? [], lists)) {
		patch.custom_lists = lists
	}

	return patch
}

export interface RateForm {
	score: number
	notes: string
	// Dates as the date fields hold them: "2026-10-12", or empty.
	startedAt: string
	completedAt: string
	repeat: number
	progress: number
	volumes: number
}

export function rateFormOf(entry: TrackerEntry): RateForm {
	return {
		score: entry.score,
		notes: entry.notes ?? '',
		startedAt: dateToInput(entry.started_at),
		completedAt: dateToInput(entry.completed_at),
		repeat: entry.repeat,
		progress: entry.progress,
		volumes: entry.progress_volumes ?? 0
	}
}

// Only the fields the user changed; volumes count for manga alone.
export function ratePatch(
	entry: TrackerEntry,
	form: RateForm,
	mediaType: TrackerMediaType
): TrackerEntryPatch {
	const saved = rateFormOf(entry)
	const patch: TrackerEntryPatch = {}

	if (saved.score !== form.score) patch.score = form.score
	if (saved.notes !== form.notes) patch.notes = form.notes
	if (saved.startedAt !== form.startedAt) patch.started_at = inputToDate(form.startedAt)
	if (saved.completedAt !== form.completedAt) patch.completed_at = inputToDate(form.completedAt)
	if (saved.repeat !== form.repeat) patch.repeat = form.repeat
	if (saved.progress !== form.progress) patch.progress = form.progress
	if (mediaType === 'manga' && saved.volumes !== form.volumes) patch.progress_volumes = form.volumes

	return patch
}

export function isEmptyPatch(patch: TrackerEntryPatch): boolean {
	return Object.keys(patch).length === 0
}
