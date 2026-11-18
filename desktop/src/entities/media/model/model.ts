import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { createEffect, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import {
	createManualMediaFx,
	deleteManualCoverFx,
	deleteManualMediaFx,
	fetchAISettingsFx,
	fetchGoogleBooksSettingsFx,
	fetchManualTitlesFx,
	fetchMediaDetailsFx,
	fetchMediaEpisodesFx,
	fetchMediaFilterOptionsFx,
	fetchTMDBSettingsFx,
	searchManualCoversFx,
	searchMediaFx,
	setAISettingsFx,
	setGoogleBooksKeyFx,
	setManualCoverFx,
	setTMDBKeyFx,
	updateManualMediaFx
} from '../api/api'
import type { MediaDetails } from '../api/api'

export const mediaDetailsQuery = createQuery({
	effect: fetchMediaDetailsFx,
	name: 'mediaDetails'
})

export const mediaEpisodesQuery = createQuery({
	effect: fetchMediaEpisodesFx,
	name: 'mediaEpisodes'
})

export const mediaSearchQuery = createQuery({
	effect: searchMediaFx,
	name: 'mediaSearch'
})

export const mediaFilterOptionsQuery = createQuery({
	effect: fetchMediaFilterOptionsFx,
	name: 'mediaFilterOptions'
})

// Each of these holds one answer for whichever title or search was asked last.
// Asked again before the first answer came, the older call is dropped: arriving
// late, it would replace what the screen now shows.
concurrency(mediaDetailsQuery, { strategy: 'TAKE_LATEST' })
concurrency(mediaEpisodesQuery, { strategy: 'TAKE_LATEST' })
concurrency(mediaSearchQuery, { strategy: 'TAKE_LATEST' })
concurrency(mediaFilterOptionsQuery, { strategy: 'TAKE_LATEST' })

export const tmdbSettingsQuery = createQuery({
	effect: fetchTMDBSettingsFx,
	name: 'tmdbSettings'
})

export const setTMDBKeyMutation = createMutation({
	effect: setTMDBKeyFx,
	name: 'setTMDBKey'
})

keepFresh(tmdbSettingsQuery, { triggers: [setTMDBKeyMutation.finished.success] })

export const googleBooksSettingsQuery = createQuery({
	effect: fetchGoogleBooksSettingsFx,
	name: 'googleBooksSettings'
})

export const setGoogleBooksKeyMutation = createMutation({
	effect: setGoogleBooksKeyFx,
	name: 'setGoogleBooksKey'
})

keepFresh(googleBooksSettingsQuery, { triggers: [setGoogleBooksKeyMutation.finished.success] })

export const aiSettingsQuery = createQuery({
	effect: fetchAISettingsFx,
	name: 'aiSettings'
})

export const setAISettingsMutation = createMutation({
	effect: setAISettingsFx,
	name: 'setAISettings'
})

keepFresh(aiSettingsQuery, { triggers: [setAISettingsMutation.finished.success] })

export const deleteManualMediaMutation = createMutation({
	effect: deleteManualMediaFx,
	name: 'deleteManualMedia'
})

export const manualTitlesQuery = createQuery({
	effect: fetchManualTitlesFx,
	name: 'manualTitles'
})

// The form saves through the effects themselves, so they are what refreshes it.
keepFresh(manualTitlesQuery, {
	triggers: [
		createManualMediaFx.done,
		updateManualMediaFx.done,
		deleteManualMediaFx.done,
		setManualCoverFx.done,
		deleteManualCoverFx.done
	]
})

export const manualCoverSearchQuery = createQuery({
	effect: searchManualCoversFx,
	name: 'manualCoverSearch'
})

concurrency(manualCoverSearchQuery, { strategy: 'TAKE_LATEST' })

export const mediaDetailsModel = atom(() => {
	const $failedMediaRef = createStore<string | null>(null)
		.on(mediaDetailsQuery.finished.failure, (_, { params }) => params)
		.reset(mediaDetailsQuery.finished.success)

	return {
		$data: mediaDetailsQuery.$data,
		$failedMediaRef,
		$pending: mediaDetailsQuery.$pending,
		detailsRequested: mediaDetailsQuery.start
	}
})

const fetchTrailerHostFx = createEffect<void, string>(() => window.mediary.trailer.host())

export const mediaPreviewModel = atom(() => {
	const previewRequested = createEvent<string>()

	const $previews = createStore<Record<string, MediaDetails>>({}).on(
		fetchMediaDetailsFx.done,
		(previews, { params, result }) => ({ ...previews, [params]: result.media })
	)

	const $inFlight = createStore<Record<string, true>>({})
		.on(fetchMediaDetailsFx, (refs, mediaRef) => ({ ...refs, [mediaRef]: true }))
		.on(fetchMediaDetailsFx.fail, (refs, { params }) => {
			const { [params]: _dropped, ...rest } = refs
			return rest
		})

	sample({
		clock: previewRequested,
		source: { previews: $previews, inFlight: $inFlight },
		filter: ({ previews, inFlight }, mediaRef) => !(mediaRef in previews) && !(mediaRef in inFlight),
		fn: (_, mediaRef) => mediaRef,
		target: fetchMediaDetailsFx
	})

	const $trailerHost = createStore<string | null>(null).on(fetchTrailerHostFx.doneData, (_, host) => host)

	const trailerHostRequested = createEvent()

	sample({
		clock: [previewRequested, trailerHostRequested],
		source: { host: $trailerHost, asking: fetchTrailerHostFx.pending },
		filter: ({ host, asking }) => host === null && !asking,
		target: fetchTrailerHostFx
	})

	const previewsRequested = createEvent<string[]>()

	const requestEachFx = createEffect((refs: string[]) => {
		for (const ref of refs) {
			previewRequested(ref)
		}
	})

	sample({ clock: previewsRequested, target: requestEachFx })

	return { $previews, $trailerHost, trailerHostRequested, previewRequested, previewsRequested }
})
