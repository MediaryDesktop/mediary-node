import { allSettled, fork } from 'effector'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'

import { fetchMediaDetailsFx } from '../api/api'
import type { MediaDetailsResponse, MediaEpisode } from '../api/api'

import {
	alternativeTitles,
	enumLabel,
	episodeTitle,
	formatMediaDate,
	mediaDetailsModel,
	mediaTitle,
	scoreTone
} from './model'

function response(mediaRef: string): MediaDetailsResponse {
	return {
		media: { media_ref: mediaRef } as MediaDetailsResponse['media'],
		sources: []
	}
}

describe('media details model', () => {
	it('remembers which title failed and forgets it after a successful load', async () => {
		const fetch = vi.fn((mediaRef: string) =>
			mediaRef === 'anilist:1'
				? Promise.reject(new Error('offline'))
				: Promise.resolve(response(mediaRef))
		)

		const scope = fork({ handlers: [[fetchMediaDetailsFx, fetch]] })

		await allSettled(mediaDetailsModel.detailsRequested, { scope, params: 'anilist:1' })
		expect(scope.getState(mediaDetailsModel.$failedMediaRef)).toBe('anilist:1')

		await allSettled(mediaDetailsModel.detailsRequested, { scope, params: 'anilist:2' })
		expect(scope.getState(mediaDetailsModel.$failedMediaRef)).toBeNull()
		expect(scope.getState(mediaDetailsModel.$data)?.media.media_ref).toBe('anilist:2')
	})
})

describe('media titles', () => {
	const title = {
		user_preferred: 'Frieren',
		romaji: 'Sousou no Frieren',
		english: 'Frieren',
		native: '葬送のフリーレン'
	}

	it('prefers the user preferred title', () => {
		expect(mediaTitle(title)).toBe('Frieren')
		expect(mediaTitle({ user_preferred: null, english: null, romaji: 'Romaji', native: null })).toBe(
			'Romaji'
		)
	})

	it('lists other titles without repeating the main one', () => {
		expect(alternativeTitles(title)).toEqual(['Sousou no Frieren', '葬送のフリーレン'])
	})
})

describe('formatMediaDate', () => {
	it('formats as much of the date as is known', () => {
		expect(formatMediaDate({ year: null, month: null, day: null }, 'en')).toBeNull()
		expect(formatMediaDate({ year: 2023, month: null, day: null }, 'en')).toBe('2023')
		expect(formatMediaDate({ year: 2023, month: 9, day: null }, 'en')).toBe('Sep 2023')
		expect(formatMediaDate({ year: 2023, month: 9, day: 29 }, 'en')).toBe('Sep 29, 2023')
	})
})

describe('enumLabel', () => {
	it('falls back to a readable form of unknown values', () => {
		const t = vi.fn(
			(_key: string, options: { defaultValue: string }) => options.defaultValue
		) as unknown as TFunction

		expect(enumLabel(t, 'relation', 'SIDE_STORY')).toBe('Side story')
		expect(enumLabel(t, 'format', null)).toBeNull()
		expect(t).toHaveBeenCalledWith('media.relation.SIDE_STORY', { defaultValue: 'Side story' })
	})
})

describe('scoreTone', () => {
	it('buckets scores the way the anilist badge colors do', () => {
		expect(scoreTone(30)).toBe('low')
		expect(scoreTone(55)).toBe('fair')
		expect(scoreTone(65)).toBe('good')
		expect(scoreTone(80)).toBe('great')
		expect(scoreTone(95)).toBe('best')
	})
})

describe('episodeTitle', () => {
	const episode = (titles: Record<string, string>, title: string | null = null) =>
		({ number: 1, title, titles }) as MediaEpisode

	it('prefers the language the app is shown in', () => {
		expect(episodeTitle(episode({ en: 'Rebirth', uk: 'Переродження' }), 'uk')).toBe('Переродження')
		expect(episodeTitle(episode({ en: 'Rebirth', uk: 'Переродження' }), 'uk-UA')).toBe('Переродження')
	})

	it('falls back to English, then the romanisation, then whatever the node chose', () => {
		expect(episodeTitle(episode({ en: 'Rebirth', 'x-jat': 'Shinsei' }), 'ru')).toBe('Rebirth')
		expect(episodeTitle(episode({ 'x-jat': 'Shinsei' }), 'ru')).toBe('Shinsei')
		expect(episodeTitle(episode({}, 'Dealings'), 'ru')).toBe('Dealings')
		expect(episodeTitle(episode({}), 'ru')).toBeNull()
	})
})
