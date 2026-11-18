import { describe, expect, it } from 'vitest'

import type { MediaEpisode } from '../api/api'

import { alternativeTitles, episodeTitle, mediaTitle } from './titles'

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
