import { combine, createEvent, createStore, sample } from 'effector'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import {
	createTrackerListMutation,
	deleteTrackerListMutation,
	renameTrackerListMutation
} from '@entities/tracker'
import type { ListMediaType, TrackerCustomList } from '@entities/tracker'

const DEFAULT_MEDIA_TYPE: ListMediaType = 'anime'

function failureMessage(error: unknown): string {
	if (error instanceof HttpRequestError && error.status === 409) {
		return translate('lists.manage.duplicate')
	}

	if (error instanceof HttpRequestError && error.status === 428) {
		return translate('lists.manage.notConnected')
	}

	if (error instanceof HttpRequestError && error.status === 503) {
		return translate('lists.manage.offline')
	}

	return translate('lists.manage.failed')
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

	const submitAccepted = sample({ clock: submitted, filter: $canSubmit })

	sample({
		clock: submitAccepted,
		source: { name: $name, mediaType: $mediaType, icon: $icon, editingID: $editingID },
		filter: ({ editingID }) => editingID === null,
		fn: ({ name, mediaType, icon }) => ({ name: name.trim(), mediaType, icon }),
		target: createTrackerListMutation.start
	})

	sample({
		clock: submitAccepted,
		source: { name: $name, icon: $icon, editingID: $editingID },
		filter: ({ editingID }) => editingID !== null,
		fn: ({ name, icon, editingID }) => ({ id: editingID as string, name: name.trim(), icon }),
		target: renameTrackerListMutation.start
	})

	sample({
		clock: [createTrackerListMutation.finished.success, renameTrackerListMutation.finished.success],
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

	for (const mutation of [
		createTrackerListMutation,
		renameTrackerListMutation,
		deleteTrackerListMutation
	]) {
		mutation.finished.failure.watch(({ error }) => {
			toast.error(failureMessage(error), { id: 'tracker-list-failed' })
		})
	}

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
		deleteRequested,
		deleteCancelled,
		deleteConfirmed,
		deletionHandled
	}
})
