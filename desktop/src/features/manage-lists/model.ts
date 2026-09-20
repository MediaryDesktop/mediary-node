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
	const submitted = createEvent()
	const deleteRequested = createEvent<string>()

	const $editingID = createStore<string | null>(null)
		.on(createRequested, () => null)
		.on(renameRequested, (_, list) => list.id)
		.reset(drawerClosed)

	const $open = createStore(false)
		.on([createRequested, renameRequested], () => true)
		.reset(drawerClosed)

	const $name = createStore('')
		.on(nameChanged, (_, name) => name)
		.on(createRequested, () => '')
		.on(renameRequested, (_, list) => list.name)
		.reset(drawerClosed)

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
		source: { name: $name, mediaType: $mediaType, editingID: $editingID },
		filter: ({ editingID }) => editingID === null,
		fn: ({ name, mediaType }) => ({ name: name.trim(), mediaType }),
		target: createTrackerListMutation.start
	})

	sample({
		clock: submitAccepted,
		source: { name: $name, editingID: $editingID },
		filter: ({ editingID }) => editingID !== null,
		fn: ({ name, editingID }) => ({ id: editingID as string, name: name.trim() }),
		target: renameTrackerListMutation.start
	})

	sample({
		clock: [createTrackerListMutation.finished.success, renameTrackerListMutation.finished.success],
		target: drawerClosed
	})

	sample({ clock: deleteRequested, target: deleteTrackerListMutation.start })

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
		$editingID,
		$canSubmit,
		$submitting,
		createRequested,
		renameRequested,
		drawerClosed,
		nameChanged,
		mediaTypeChanged,
		submitted,
		deleteRequested
	}
})
