import { combine, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { isLocalTrackerType, preferredTitle, trackerListsQuery, updateTrackerEntryMutation } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType, TrackerStatus } from '@entities/tracker'

import { today } from '../lib/entry-dates'
import { isEmptyPatch, managePatch } from '../lib/patches'

import type { EntryTarget, NewEntryTarget } from './types'

interface ManageTarget {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
	entry: TrackerEntry | null
}

export const manageEntryModel = atom(() => {
	const opened = createEvent<EntryTarget>()
	const addOpened = createEvent<NewEntryTarget>()
	const closed = createEvent()
	const statusChanged = createEvent<TrackerStatus>()
	const listsChanged = createEvent<string[]>()
	const submitted = createEvent()

	const createListRequested = createEvent()
	const listCreated = createEvent<string>()

	const $target = createStore<ManageTarget | null>(null)
		.on(opened, (_, { entry, mediaType }) => ({
			mediaRef: entry.media_ref,
			mediaType,
			title: preferredTitle(entry.media.title),
			entry
		}))
		.on(addOpened, (_, target) => ({ ...target, entry: null }))

	const $adding = $target.map(target => target !== null && target.entry === null)

	const $open = createStore(false)
		.on([opened, addOpened], () => true)
		.reset(closed)

	const $status = createStore<TrackerStatus>('CURRENT')
		.on(opened, (_, { entry }) => entry.status as TrackerStatus)
		.on(addOpened, () => 'PLANNING')
		.on(statusChanged, (_, status) => status)

	const $lists = createStore<string[]>([])
		.on(opened, (_, { entry }) => entry.custom_lists ?? [])
		.on(addOpened, () => [])
		.on(listsChanged, (_, lists) => lists)
		.on(listCreated, (lists, name) => (lists.includes(name) ? lists : [...lists, name]))

	const $dirty = combine($target, $status, $lists, (target, status, lists) =>
		target ? !isEmptyPatch(managePatch(target.entry, status, lists, today())) : false
	)

	sample({
		clock: submitted,
		source: { target: $target, status: $status, lists: $lists },
		filter: ({ target }) => target !== null,
		fn: ({ target, status, lists }) => {
			const { mediaRef, entry } = target as ManageTarget

			return { mediaRef, patch: managePatch(entry, status, lists, today()) }
		},
		target: updateTrackerEntryMutation.start
	})

	const added = sample({
		clock: updateTrackerEntryMutation.finished.success,
		source: $target,
		filter: (target, { params }) => target?.entry === null && target.mediaRef === params.mediaRef
	})

	added.watch(target => {
		if (target) {
			const key = isLocalTrackerType(target.mediaType) ? 'lists.addEntry.doneLocal' : 'lists.addEntry.done'
			toast.success(translate(key, { title: target.title }))
		}
	})

	sample({ clock: updateTrackerEntryMutation.finished.success, target: closed })

	sample({ clock: [opened, addOpened], target: trackerListsQuery.start })

	return {
		$open,
		$target,
		$adding,
		$status,
		$lists,
		$dirty,
		$saving: updateTrackerEntryMutation.$pending,
		opened,
		addOpened,
		closed,
		statusChanged,
		listsChanged,
		submitted,
		createListRequested,
		listCreated
	}
})
