import { describe, expect, it } from 'vitest'

import { matchesFilter } from './filter'
import { languageName } from './languages'

const nyaa = {
	id: 'nyaa',
	name: 'Nyaa',
	author: 'someone',
	description: 'Anime releases from nyaa.si',
	type: 'torrent-provider',
	lang: 'en'
}

const all = { type: 'all', language: 'all', search: '' }

describe('matchesFilter', () => {
	it('keeps everything with no filter', () => {
		expect(matchesFilter(nyaa, all)).toBe(true)
	})

	it('filters by type', () => {
		expect(matchesFilter(nyaa, { ...all, type: 'torrent-provider' })).toBe(true)
		expect(matchesFilter(nyaa, { ...all, type: 'manga-provider' })).toBe(false)
	})

	it('shows a plugin for many languages under each of them', () => {
		expect(matchesFilter(nyaa, { ...all, language: 'en' })).toBe(true)
		expect(matchesFilter(nyaa, { ...all, language: 'uk' })).toBe(false)
		expect(matchesFilter({ ...nyaa, lang: 'multi' }, { ...all, language: 'uk' })).toBe(true)
	})

	it('searches name, id, author and description, ignoring case', () => {
		for (const search of ['NYAA', 'some', 'nyaa.si', '  anime ']) {
			expect(matchesFilter(nyaa, { ...all, search })).toBe(true)
		}
		expect(matchesFilter(nyaa, { ...all, search: 'manga' })).toBe(false)
	})
})

describe('languageName', () => {
	it('names a language by its own name', () => {
		expect(languageName('uk', 'Many')).toBe('Українська')
		expect(languageName('multi', 'Many')).toBe('Many')
		expect(languageName('xx', 'Many')).toBe('XX')
		expect(languageName(undefined, 'Many')).toBe('')
	})
})
