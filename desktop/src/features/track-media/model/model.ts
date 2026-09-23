import { combine, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { trackerListsQuery, trackerModel, updateTrackerEntryMutation } from '@entities/tracker'
import type { TrackerEntry, TrackerEntryPatch, TrackerMediaType, TrackerStatus } from '@entities/tracker'

import { dateToInput, inputToDate, today } from '../lib/entry-dates'

const SYNC_TOAST = 'tracker-sync'
const SYNC_PATIENCE_MS = 10_000

let syncing = false
let patience: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
	if (patience !== null) {
		clearTimeout(patience)
		patience = null
	}
}

trackerModel.entryUpdated.watch(({ result }) => {
	if (!result.sync_pending) {
		return
	}

	syncing = true
	stopWaiting()

	toast.loading(translate('lists.sync.progress'), { id: SYNC_TOAST })

	patience = setTimeout(() => {
		patience = null
		toast.warning(translate('lists.sync.delayed'), { id: SYNC_TOAST })
	}, SYNC_PATIENCE_MS)
})

trackerModel.entriesSynced.watch(() => {
	if (!syncing) {
		return
	}

	syncing = false
	stopWaiting()

	toast.success(translate('lists.sync.done'), { id: SYNC_TOAST })
})

trackerModel.entryUpdateFailed.watch(() => {
	syncing = false
	stopWaiting()

	toast.dismiss(SYNC_TOAST)
	toast.error(translate('lists.updateFailed'), { id: 'tracker-update-failed' })
})

export interface EntryTarget {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

function sameLists(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every(name => right.includes(name))
}

export const manageEntryModel = atom(() => {
	const opened = createEvent<EntryTarget>()
	const closed = createEvent()
	const statusChanged = createEvent<TrackerStatus>()
	const listsChanged = createEvent<string[]>()
	const submitted = createEvent()

	const $target = createStore<EntryTarget | null>(null)
		.on(opened, (_, target) => target)
		.reset(closed)

	const $status = createStore<TrackerStatus>('CURRENT')
		.on(opened, (_, { entry }) => entry.status as TrackerStatus)
		.on(statusChanged, (_, status) => status)

	const $lists = createStore<string[]>([])
		.on(opened, (_, { entry }) => entry.custom_lists ?? [])
		.on(listsChanged, (_, lists) => lists)

	const $dirty = combine($target, $status, $lists, (target, status, lists) => {
		if (!target) {
			return false
		}

		return target.entry.status !== status || !sameLists(target.entry.custom_lists ?? [], lists)
	})

	sample({
		clock: submitted,
		source: { target: $target, status: $status, lists: $lists },
		filter: ({ target }) => target !== null,
		fn: ({ target, status, lists }) => {
			const entry = (target as EntryTarget).entry
			const patch: TrackerEntryPatch = {}

			if (entry.status !== status) {
				patch.status = status

				if (!entry.started_at?.year && (status === 'CURRENT' || status === 'COMPLETED')) {
					patch.started_at = inputToDate(today())
				}

				if (!entry.completed_at?.year && status === 'COMPLETED') {
					patch.completed_at = inputToDate(today())
				}
			}

			if (!sameLists(entry.custom_lists ?? [], lists)) {
				patch.custom_lists = lists
			}

			return { mediaRef: entry.media_ref, patch }
		},
		target: updateTrackerEntryMutation.start
	})

	sample({ clock: updateTrackerEntryMutation.finished.success, target: closed })

	sample({ clock: opened, target: trackerListsQuery.start })

	return {
		$open: $target.map(target => target !== null),
		$target,
		$status,
		$lists,
		$dirty,
		$saving: updateTrackerEntryMutation.$pending,
		opened,
		closed,
		statusChanged,
		listsChanged,
		submitted
	}
})

export const rateEntryModel = atom(() => {
	const opened = createEvent<EntryTarget>()
	const closed = createEvent()
	const scoreChanged = createEvent<number>()
	const notesChanged = createEvent<string>()
	const startedAtChanged = createEvent<string>()
	const completedAtChanged = createEvent<string>()
	const repeatChanged = createEvent<number>()
	const progressChanged = createEvent<number>()
	const volumesChanged = createEvent<number>()
	const submitted = createEvent()

	const $target = createStore<EntryTarget | null>(null)
		.on(opened, (_, target) => target)
		.reset(closed)

	const $score = createStore(0)
		.on(opened, (_, { entry }) => entry.score)
		.on(scoreChanged, (_, score) => score)

	const $notes = createStore('')
		.on(opened, (_, { entry }) => entry.notes ?? '')
		.on(notesChanged, (_, notes) => notes)

	const $startedAt = createStore('')
		.on(opened, (_, { entry }) => dateToInput(entry.started_at))
		.on(startedAtChanged, (_, value) => value)

	const $completedAt = createStore('')
		.on(opened, (_, { entry }) => dateToInput(entry.completed_at))
		.on(completedAtChanged, (_, value) => value)

	const $repeat = createStore(0)
		.on(opened, (_, { entry }) => entry.repeat)
		.on(repeatChanged, (_, repeat) => repeat)

	const $progress = createStore(0)
		.on(opened, (_, { entry }) => entry.progress)
		.on(progressChanged, (_, progress) => progress)

	const $volumes = createStore(0)
		.on(opened, (_, { entry }) => entry.progress_volumes ?? 0)
		.on(volumesChanged, (_, volumes) => volumes)

	const $form = combine({
		score: $score,
		notes: $notes,
		startedAt: $startedAt,
		completedAt: $completedAt,
		repeat: $repeat,
		progress: $progress,
		volumes: $volumes
	})

	const $dirty = combine($target, $form, (target, form) => {
		if (!target) {
			return false
		}

		const { entry } = target

		return (
			entry.score !== form.score ||
			(entry.notes ?? '') !== form.notes ||
			dateToInput(entry.started_at) !== form.startedAt ||
			dateToInput(entry.completed_at) !== form.completedAt ||
			entry.repeat !== form.repeat ||
			entry.progress !== form.progress ||
			(entry.progress_volumes ?? 0) !== form.volumes
		)
	})

	sample({
		clock: submitted,
		source: { target: $target, form: $form },
		filter: ({ target }) => target !== null,
		fn: ({ target, form }) => {
			const { entry, mediaType } = target as EntryTarget
			const patch: TrackerEntryPatch = {}

			if (entry.score !== form.score) {
				patch.score = form.score
			}

			if ((entry.notes ?? '') !== form.notes) {
				patch.notes = form.notes
			}

			if (dateToInput(entry.started_at) !== form.startedAt) {
				patch.started_at = inputToDate(form.startedAt)
			}

			if (dateToInput(entry.completed_at) !== form.completedAt) {
				patch.completed_at = inputToDate(form.completedAt)
			}

			if (entry.repeat !== form.repeat) {
				patch.repeat = form.repeat
			}

			if (entry.progress !== form.progress) {
				patch.progress = form.progress
			}

			if (mediaType === 'manga' && (entry.progress_volumes ?? 0) !== form.volumes) {
				patch.progress_volumes = form.volumes
			}

			return { mediaRef: entry.media_ref, patch }
		},
		target: updateTrackerEntryMutation.start
	})

	sample({ clock: updateTrackerEntryMutation.finished.success, target: closed })

	return {
		$open: $target.map(target => target !== null),
		$target,
		$score,
		$notes,
		$startedAt,
		$completedAt,
		$repeat,
		$progress,
		$volumes,
		$dirty,
		$saving: updateTrackerEntryMutation.$pending,
		opened,
		closed,
		scoreChanged,
		notesChanged,
		startedAtChanged,
		completedAtChanged,
		repeatChanged,
		progressChanged,
		volumesChanged,
		submitted
	}
})
