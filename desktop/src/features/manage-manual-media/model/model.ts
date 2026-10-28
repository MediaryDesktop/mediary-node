import { combine, createEvent, createStore, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import {
	createManualMediaMutation,
	deleteManualMediaMutation,
	manualMediaID,
	suggestManualMediaMutation,
	updateManualMediaMutation
} from '@entities/media'
import type { ManualMediaType, MediaDetails, UpdateManualMediaParams } from '@entities/media'
import { TRACKER_MEDIA_TYPES, trackerQueries } from '@entities/tracker'

import {
	canSubmitForm,
	draftFromForm,
	emptyForm,
	formErrors,
	formFromMedia,
	hintFromForm,
	mergeSuggestion
} from '../lib/draft'
import type { ManualMediaField, ManualMediaForm } from '../lib/draft'

export interface ManualMediaRequest {
	mediaType?: ManualMediaType
	title?: string
	// Whoever asked stays where they are once the title exists, instead of the
	// title page opening: they have something left to do with it.
	stay?: boolean
}

export interface ManualMediaCreated {
	mediaRef: string
	stay: boolean
}

export interface ManualMediaTarget {
	mediaRef: string
	title: string
}

function failureMessage(error: unknown): string {
	if (error instanceof HttpRequestError && error.status === 404) {
		return translate('manualMedia.notFound')
	}

	return translate('manualMedia.failed')
}

// A missing or refused key is the one failure the user can fix themselves, and
// the node's own sentence about it would be in English.
function suggestionFailure(error: HttpRequestError): string {
	if (error.status === 428) {
		return translate('manualMedia.ai.needsKey')
	}

	return problemDetail(error, translate('manualMedia.ai.failed'))
}

interface AppliedSuggestion {
	form: ManualMediaForm
	filled: ManualMediaField[]
	recognized: boolean
}

export const manualMediaModel = atom(() => {
	const createRequested = createEvent<ManualMediaRequest | void>()
	const editRequested = createEvent<MediaDetails>()
	const drawerClosed = createEvent()
	const fieldsChanged = createEvent<Partial<Omit<ManualMediaForm, 'mediaType'>>>()
	const mediaTypeChanged = createEvent<ManualMediaType>()
	const submitted = createEvent()
	const deleteRequested = createEvent<ManualMediaTarget>()
	const deleteCancelled = createEvent()
	const deleteConfirmed = createEvent()
	// Carries the app's language: the description comes back written in it.
	const suggestRequested = createEvent<string>()
	const suggestionApplied = createEvent<AppliedSuggestion>()

	const $editingRef = createStore<string | null>(null)
		.on(createRequested, () => null)
		.on(editRequested, (_, media) => media.media_ref)

	const $stay = createStore(false)
		.on(createRequested, (_, request) => request?.stay ?? false)
		.on(editRequested, () => false)

	const $open = createStore(false)
		.on([createRequested, editRequested], () => true)
		.reset(drawerClosed)

	const $form = createStore<ManualMediaForm>(emptyForm('anime'))
		.on(createRequested, (current, request) =>
			emptyForm(request?.mediaType ?? current.mediaType, request?.title?.trim() ?? '')
		)
		.on(editRequested, (_, media) => formFromMedia(media))
		.on(fieldsChanged, (form, patch) => ({ ...form, ...patch }))
		// A format belongs to one kind of title; the one picked for the last kind
		// would be refused for the next.
		.on(mediaTypeChanged, (form, mediaType) => ({ ...form, mediaType, format: null }))
		.on(suggestionApplied, (_, { form }) => form)

	// What Claude filled in, marked until the user has looked at it: a field
	// they change is theirs again.
	const $suggested = createStore<ManualMediaField[]>([])
		.on(suggestionApplied, (current, { filled }) => [...new Set([...current, ...filled])])
		.on(fieldsChanged, (current, patch) => current.filter(field => !(field in patch)))
		.reset(createRequested, editRequested, mediaTypeChanged)

	const $errors = $form.map(formErrors)

	const $submitting = combine(
		createManualMediaMutation.$pending,
		updateManualMediaMutation.$pending,
		(creating, updating) => creating || updating
	)

	const $suggesting = suggestManualMediaMutation.$pending

	const $canSuggest = combine(
		$form,
		$submitting,
		$suggesting,
		(form, submitting, suggesting) => form.title.trim() !== '' && !submitting && !suggesting
	)

	sample({
		clock: suggestRequested,
		source: $form,
		filter: $canSuggest,
		fn: (form, language) => hintFromForm(form, language),
		target: suggestManualMediaMutation.start
	})

	// An answer that arrives after the drawer closed belongs to nothing on screen.
	sample({
		clock: suggestManualMediaMutation.finished.success,
		source: { form: $form, open: $open },
		filter: ({ open }) => open,
		fn: ({ form }, { result }): AppliedSuggestion => ({
			...mergeSuggestion(form, result.draft),
			recognized: result.recognized
		}),
		target: suggestionApplied
	})

	suggestionApplied.watch(({ filled, recognized }) => {
		if (!recognized) {
			toast.info(translate('manualMedia.ai.unknown'), { id: 'manual-media-suggest' })
		} else if (filled.length === 0) {
			toast.info(translate('manualMedia.ai.nothingNew'), { id: 'manual-media-suggest' })
		} else {
			toast.success(translate('manualMedia.ai.filled', { count: filled.length }), {
				id: 'manual-media-suggest'
			})
		}
	})

	suggestManualMediaMutation.finished.failure.watch(({ error }) => {
		toast.error(suggestionFailure(error), { id: 'manual-media-suggest' })
	})

	const $canSubmit = combine($form, $submitting, (form, submitting) => !submitting && canSubmitForm(form))

	const submitAccepted = sample({ clock: submitted, filter: $canSubmit })

	sample({
		clock: submitAccepted,
		source: { form: $form, editing: $editingRef },
		filter: ({ editing }) => editing === null,
		fn: ({ form }) => draftFromForm(form),
		target: createManualMediaMutation.start
	})

	const updateAccepted = sample({
		clock: submitAccepted,
		source: { form: $form, editing: $editingRef },
		fn: ({ form, editing }): UpdateManualMediaParams | null =>
			editing === null ? null : { id: manualMediaID(editing), draft: draftFromForm(form) }
	})

	sample({
		clock: updateAccepted,
		filter: (params): params is UpdateManualMediaParams => params !== null,
		target: updateManualMediaMutation.start
	})

	sample({
		clock: [createManualMediaMutation.finished.success, updateManualMediaMutation.finished.success],
		target: drawerClosed
	})

	// The lists show the title's name and kind as the node last described them.
	for (const mediaType of TRACKER_MEDIA_TYPES) {
		sample({
			clock: updateManualMediaMutation.finished.success,
			filter: ({ result }) => result.media.media_type === mediaType,
			target: trackerQueries[mediaType].refresh
		})
	}

	const created = sample({
		clock: createManualMediaMutation.finished.success,
		source: $stay,
		fn: (stay, { result }): ManualMediaCreated => ({ mediaRef: result.media.media_ref, stay })
	})

	const $deleting = createStore<ManualMediaTarget | null>(null).on(deleteRequested, (_, target) => target)

	const $deleteOpen = createStore(false)
		.on(deleteRequested, () => true)
		.reset(deleteCancelled, deleteManualMediaMutation.finished.finally)

	const deleteAccepted = sample({
		clock: deleteConfirmed,
		source: $deleting,
		fn: target => (target === null ? null : manualMediaID(target.mediaRef))
	})

	sample({
		clock: deleteAccepted,
		filter: (id): id is string => id !== null,
		target: deleteManualMediaMutation.start
	})

	const deleted = deleteManualMediaMutation.finished.success.map(({ params }) => `manual:${params}`)

	deleteManualMediaMutation.finished.success.watch(() => {
		toast.success(translate('manualMedia.deleted'))
	})

	for (const mutation of [
		createManualMediaMutation,
		updateManualMediaMutation,
		deleteManualMediaMutation
	]) {
		mutation.finished.failure.watch(({ error }) => {
			toast.error(failureMessage(error), { id: 'manual-media-failed' })
		})
	}

	return {
		$open,
		$form,
		$suggested,
		$suggesting,
		$canSuggest,
		$errors,
		$editingRef,
		$canSubmit,
		$submitting,
		$deleting,
		$deleteOpen,
		$deletePending: deleteManualMediaMutation.$pending,
		createRequested,
		editRequested,
		drawerClosed,
		fieldsChanged,
		mediaTypeChanged,
		submitted,
		deleteRequested,
		deleteCancelled,
		deleteConfirmed,
		suggestRequested,
		created,
		deleted
	}
})
