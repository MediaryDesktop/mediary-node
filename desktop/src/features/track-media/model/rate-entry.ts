import { combine, createEvent, createStore, merge, sample } from 'effector'

import { atom, onEach } from '@shared/factory'

import { preferredTitle, updateTrackerEntryMutation } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { isEmptyPatch, rateFormOf, ratePatch } from '../lib/patches'

import { announceAdded } from './added-toast'
import type { EntryTarget, NewEntryTarget } from './types'

interface RateTarget {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
	// Null for a title on no list yet: saving the rating adds it, as PLANNING.
	entry: TrackerEntry | null
}

export const rateEntryModel = atom(() => {
	const opened = createEvent<EntryTarget>()
	const addOpened = createEvent<NewEntryTarget>()
	const closed = createEvent()
	const scoreChanged = createEvent<number>()
	const notesChanged = createEvent<string>()
	const startedAtChanged = createEvent<string>()
	const completedAtChanged = createEvent<string>()
	const repeatChanged = createEvent<number>()
	const progressChanged = createEvent<number>()
	const volumesChanged = createEvent<number>()
	const submitted = createEvent()

	const shown = merge([
		opened.map(({ entry, mediaType }): RateTarget => ({
			mediaRef: entry.media_ref,
			mediaType,
			title: preferredTitle(entry.media.title),
			entry
		})),
		addOpened.map((target): RateTarget => ({ ...target, entry: null }))
	])

	const $target = createStore<RateTarget | null>(null).on(shown, (_, target) => target)

	const $open = createStore(false)
		.on(shown, () => true)
		.reset(closed)

	const $score = createStore(0)
		.on(shown, (_, { entry }) => rateFormOf(entry).score)
		.on(scoreChanged, (_, score) => score)

	const $notes = createStore('')
		.on(shown, (_, { entry }) => rateFormOf(entry).notes)
		.on(notesChanged, (_, notes) => notes)

	const $startedAt = createStore('')
		.on(shown, (_, { entry }) => rateFormOf(entry).startedAt)
		.on(startedAtChanged, (_, value) => value)

	const $completedAt = createStore('')
		.on(shown, (_, { entry }) => rateFormOf(entry).completedAt)
		.on(completedAtChanged, (_, value) => value)

	const $repeat = createStore(0)
		.on(shown, (_, { entry }) => rateFormOf(entry).repeat)
		.on(repeatChanged, (_, repeat) => repeat)

	const $progress = createStore(0)
		.on(shown, (_, { entry }) => rateFormOf(entry).progress)
		.on(progressChanged, (_, progress) => progress)

	const $volumes = createStore(0)
		.on(shown, (_, { entry }) => rateFormOf(entry).volumes)
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
			const { mediaRef, entry, mediaType } = target as RateTarget

			return { mediaRef, patch: ratePatch(entry, form, mediaType) }
		},
		target: updateTrackerEntryMutation.start
	})

	const added = sample({
		clock: updateTrackerEntryMutation.finished.success,
		source: $target,
		filter: (target, { params }) => target?.entry === null && target.mediaRef === params.mediaRef
	})

	onEach(added, target => {
		if (target) {
			announceAdded(target)
		}
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
		addOpened,
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
