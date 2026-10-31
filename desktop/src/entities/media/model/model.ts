import { createMutation, createQuery, keepFresh } from '@farfetched/core'
import { createEffect, createEvent, createStore, sample } from 'effector'
import type { TFunction } from 'i18next'

import { atom } from '@shared/factory'
import { firstPresent } from '@shared/lib'

import {
	createManualMediaFx,
	deleteManualCoverFx,
	deleteManualMediaFx,
	fetchAISettingsFx,
	fetchGoogleBooksSettingsFx,
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
	suggestManualMediaFx,
	updateManualMediaFx
} from '../api/api'
import type { MediaDate, MediaDetails, MediaEpisode, MediaTitle } from '../api/api'

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

export const createManualMediaMutation = createMutation({
	effect: createManualMediaFx,
	name: 'createManualMedia'
})

export const updateManualMediaMutation = createMutation({
	effect: updateManualMediaFx,
	name: 'updateManualMedia'
})

export const deleteManualMediaMutation = createMutation({
	effect: deleteManualMediaFx,
	name: 'deleteManualMedia'
})

export const suggestManualMediaMutation = createMutation({
	effect: suggestManualMediaFx,
	name: 'suggestManualMedia'
})

export const manualCoverSearchQuery = createQuery({
	effect: searchManualCoversFx,
	name: 'manualCoverSearch'
})

export const setManualCoverMutation = createMutation({
	effect: setManualCoverFx,
	name: 'setManualCover'
})

export const deleteManualCoverMutation = createMutation({
	effect: deleteManualCoverFx,
	name: 'deleteManualCover'
})

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

	sample({
		clock: previewRequested,
		source: { host: $trailerHost, asking: fetchTrailerHostFx.pending },
		filter: ({ host, asking }) => host === null && !asking,
		target: fetchTrailerHostFx
	})

	return { $previews, $trailerHost, previewRequested }
})

export function mediaTitle(title: MediaTitle): string {
	return firstPresent(title.user_preferred, title.english, title.romaji, title.native)
}

// The user's own language first, then English, then the romanisation a fan of the
// original would recognise. The node only sends the languages the app speaks.
export function episodeTitle(episode: MediaEpisode, language: string): string | null {
	const titles = episode.titles ?? {}
	const base = language.split('-')[0] ?? language

	return titles[language] ?? titles[base] ?? titles.en ?? titles['x-jat'] ?? episode.title ?? null
}

export function alternativeTitles(title: MediaTitle): string[] {
	const main = mediaTitle(title)
	const seen = new Set([main])
	const result: string[] = []

	for (const candidate of [title.english, title.romaji, title.native]) {
		if (candidate && !seen.has(candidate)) {
			seen.add(candidate)
			result.push(candidate)
		}
	}

	return result
}

export type MediaEnumGroup = 'format' | 'status' | 'season' | 'relation' | 'origin'

function humanizeEnum(value: string): string {
	const text = value.toLowerCase().replaceAll('_', ' ')
	return text.charAt(0).toUpperCase() + text.slice(1)
}

export function enumLabel(
	t: TFunction,
	group: MediaEnumGroup,
	value: string | null | undefined
): string | null {
	if (!value) {
		return null
	}

	const key = `media.${group}.${value}`

	return t(key as never, { defaultValue: humanizeEnum(value) }) as string
}

export type ScoreTone = 'low' | 'fair' | 'good' | 'great' | 'best'

export function scoreTone(score: number): ScoreTone {
	if (score < 40) {
		return 'low'
	}

	if (score < 60) {
		return 'fair'
	}

	if (score < 70) {
		return 'good'
	}

	if (score < 82) {
		return 'great'
	}

	return 'best'
}

export function formatMediaDate(date: MediaDate, locale: string): string | null {
	if (!date.year) {
		return null
	}

	if (!date.month) {
		return String(date.year)
	}

	const value = new Date(Date.UTC(date.year, date.month - 1, date.day ?? 1))

	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: date.day ? 'numeric' : undefined,
		timeZone: 'UTC'
	}).format(value)
}
