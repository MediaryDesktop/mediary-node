import { createQuery } from '@farfetched/core'
import { createEffect, createEvent, createStore, sample } from 'effector'
import type { TFunction } from 'i18next'

import { atom } from '@shared/factory'

import { fetchMediaDetailsFx } from '../api/api'
import type { MediaDate, MediaDetails, MediaTitle } from '../api/api'

export const mediaDetailsQuery = createQuery({
	effect: fetchMediaDetailsFx,
	name: 'mediaDetails'
})

export const mediaDetailsModel = atom(() => {
	const $failedMediaRef = createStore<string | null>(null)
		.on(mediaDetailsQuery.finished.failure, (_, { params }) => params)
		.reset(mediaDetailsQuery.finished.success)

	return {
		$data: mediaDetailsQuery.$data,
		$failedMediaRef,
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
	return title.user_preferred ?? title.english ?? title.romaji ?? title.native ?? ''
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
