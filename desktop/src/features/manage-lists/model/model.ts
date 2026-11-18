import { combine, createEvent, createStore, merge, sample } from 'effector'

import { HttpRequestError } from '@shared/api'
import { atom, onEach, ownRequest } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import {
	createTrackerListMutation,
	deleteTrackerListMutation,
	renameTrackerListMutation
} from '@entities/tracker'
import type { ListMediaType, TrackerCustomList } from '@entities/tracker'

const DEFAULT_MEDIA_TYPE: ListMediaType = 'anime'

// 409 — a list of that name exists, 428 — the list lives on AniList and it is
// not connected, 503 — the node cannot reach where the list lives.
function failureMessage(error: unknown): string {
	switch (error instanceof HttpRequestError ? error.status : null) {
		case 409:
			return translate('lists.manage.duplicate')
		case 428:
			return translate('lists.manage.notConnected')
		case 503:
			return translate('lists.manage.offline')
		default:
			return translate('lists.manage.failed')
	}
}

export const manageListsModel = atom(() => {
	const createRequested = createEvent<ListMediaType | void>()
	const renameRequested = createEvent<TrackerCustomList>()
	const drawerClosed = createEvent()
	const nameChanged = createEvent<string>()
	const mediaTypeChanged = createEvent<ListMediaType>()
	const iconChanged = createEvent<string>()
	const submitted = createEvent()
	const deleteRequested = createEvent<TrackerCustomList>()
	const deleteCancelled = createEvent()
	const deleteConfirmed = createEvent()
	const deletionHandled = createEvent()

	const $editingID = createStore<string | null>(null)
		.on(createRequested, () => null)
		.on(renameRequested, (_, list) => list.id)

	const $open = createStore(false)
		.on([createRequested, renameRequested], () => true)
		.reset(drawerClosed)

	const $name = createStore('')
		.on(nameChanged, (_, name) => name)
		.on(createRequested, () => '')
		.on(renameRequested, (_, list) => list.name)

	const $icon = createStore('')
		.on(iconChanged, (_, icon) => icon)
		.on(createRequested, () => '')
		.on(renameRequested, (_, list) => list.icon ?? '')

	const $mediaType = createStore<ListMediaType>(DEFAULT_MEDIA_TYPE)
		.on(mediaTypeChanged, (_, mediaType) => mediaType)
		.on(createRequested, (current, mediaType) => mediaType ?? current)
		.on(renameRequested, (_, list) => list.media_type)

	const $submitting = combine(
		createTrackerListMutation.$pending,
		renameTrackerListMutation.$pending,
		(creating, renaming) => creating || renaming
	)

	const $canSubmit = combine(
		$name,
		$submitting,
		(name, submitting) => name.trim().length > 0 && !submitting
	)

	// The drawer is opened from several places — the lists page, the entry
	// drawer, the hand-made title form — and each wants to hear of the list it
	// asked for, not of any list created anywhere.
	const creation = ownRequest(createTrackerListMutation)

	const created = creation.succeeded.map(({ result }) => result)

	const submitAccepted = sample({ clock: submitted, filter: $canSubmit })

	sample({
		clock: submitAccepted,
		source: { name: $name, mediaType: $mediaType, icon: $icon, editingID: $editingID },
		filter: ({ editingID }) => editingID === null,
		fn: ({ name, mediaType, icon }) => ({ name: name.trim(), mediaType, icon }),
		target: creation.sent
	})

	sample({
		clock: submitAccepted,
		source: { name: $name, icon: $icon, editingID: $editingID },
		filter: ({ editingID }) => editingID !== null,
		fn: ({ name, icon, editingID }) => ({ id: editingID as string, name: name.trim(), icon }),
		target: renameTrackerListMutation.start
	})

	sample({
		clock: [created, renameTrackerListMutation.finished.success],
		target: drawerClosed
	})

	const $deleting = createStore<TrackerCustomList | null>(null).on(deleteRequested, (_, list) => list)

	const $deleteOpen = createStore(false)
		.on(deleteRequested, () => true)
		.reset(deleteCancelled, deleteTrackerListMutation.finished.finally)

	const $deleted = createStore<string | null>(null)
		.on(deleteTrackerListMutation.finished.success, (_, { params }) => params)
		.reset(deleteRequested, deletionHandled)

	const $deletingId = $deleting.map(list => list?.id ?? null)

	sample({
		clock: deleteConfirmed,
		source: $deletingId,
		filter: (id): id is string => id !== null,
		target: deleteTrackerListMutation.start
	})

	const failed = merge([
		createTrackerListMutation.finished.failure.map(({ error }) => error),
		renameTrackerListMutation.finished.failure.map(({ error }) => error),
		deleteTrackerListMutation.finished.failure.map(({ error }) => error)
	])

	onEach(failed, error => toast.error(failureMessage(error), { id: 'tracker-list-failed' }))

	return {
		$open,
		$name,
		$mediaType,
		$icon,
		$editingID,
		$canSubmit,
		$submitting,
		$deleting,
		$deleteOpen,
		$deleted,
		$deletePending: deleteTrackerListMutation.$pending,
		createRequested,
		renameRequested,
		drawerClosed,
		nameChanged,
		mediaTypeChanged,
		iconChanged,
		submitted,
		created,
		deleteRequested,
		deleteCancelled,
		deleteConfirmed,
		deletionHandled
	}
})
