import { combine, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { updateTrackerEntryMutation } from '@entities/tracker'

import { dateToInput } from '../lib/entry-dates'
import { isEmptyPatch, ratePatch } from '../lib/patches'

import type { EntryTarget } from './types'

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

	const $target = createStore<EntryTarget | null>(null).on(opened, (_, target) => target)

	const $open = createStore(false)
		.on(opened, () => true)
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

	const $dirty = combine($target, $form, (target, form) =>
		target ? !isEmptyPatch(ratePatch(target.entry, form, target.mediaType)) : false
	)

	sample({
		clock: submitted,
		source: { target: $target, form: $form },
		filter: ({ target }) => target !== null,
		fn: ({ target, form }) => {
			const { entry, mediaType } = target as EntryTarget

			return { mediaRef: entry.media_ref, patch: ratePatch(entry, form, mediaType) }
		},
		target: updateTrackerEntryMutation.start
	})

	sample({ clock: updateTrackerEntryMutation.finished.success, target: closed })

	return {
		$open,
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
