import { describe, expect, it } from 'vitest'

import type { MediaDetails } from '@entities/media'

import {
	canSubmitForm,
	draftFromForm,
	emptyForm,
	formErrors,
	formFromMedia,
	hintFromForm,
	mergeSuggestion
} from './draft'

describe('hintFromForm', () => {
	it('tells Claude what the form already knows beyond the name', () => {
		const form = {
			...emptyForm('anime', ' Rare OVA '),
			year: '1994',
			originalTitle: 'レアOVA',
			studios: 'Studio X, Studio Y',
			authors: 'ignored for an anime'
		}

		expect(hintFromForm(form, 'uk')).toEqual({
			media_type: 'anime',
			title: 'Rare OVA',
			year: 1994,
			language: 'uk',
			note: 'Original title: レアOVA. Studios: Studio X, Studio Y'
		})
		expect(hintFromForm(emptyForm('movie', 'x'), 'de')).toEqual({
			media_type: 'movie',
			title: 'x',
			language: 'en'
		})
	})
})

describe('mergeSuggestion', () => {
	it('fills only what the user left empty', () => {
		const form = { ...emptyForm('series', 'Show'), year: '2001', genres: 'Mine' }

		const { form: merged, filled } = mergeSuggestion(form, {
			media_type: 'series',
			title: 'Renamed by Claude',
			year: 1999,
			episodes: 6,
			duration: 45,
			genres: ['Drama'],
			description: 'About',
			status: 'FINISHED'
		})

		expect(merged).toMatchObject({
			title: 'Show',
			year: '2001',
			genres: 'Mine',
			episodes: '6',
			duration: '45',
			description: 'About',
			status: 'FINISHED'
		})
		expect(filled.sort()).toEqual(['description', 'duration', 'episodes', 'status'])
	})
})

describe('draftFromForm', () => {
	it('sends only what the kind of title has and what was filled in', () => {
		const form = {
			...emptyForm('manga', '  Doujin  '),
			episodes: '12',
			chapters: '5',
			volumes: '',
			duration: '24',
			genres: 'Drama, , Romance',
			studios: 'Madhouse',
			authors: 'Someone',
			synonyms: 'One, with a comma\n\nAnother'
		}

		expect(draftFromForm(form)).toEqual({
			media_type: 'manga',
			title: 'Doujin',
			chapters: 5,
			genres: ['Drama', 'Romance'],
			authors: ['Someone'],
			synonyms: ['One, with a comma', 'Another']
		})
	})

	it('drops a format that belongs to another kind', () => {
		const form = { ...emptyForm('movie', 'Film'), format: 'OVA' as const }

		expect(draftFromForm(form).format).toBeUndefined()
	})

	it('leaves a zero count out, as the node would', () => {
		expect(draftFromForm({ ...emptyForm('series', 'Show'), episodes: '0' }).episodes).toBeUndefined()
	})
})

describe('formErrors', () => {
	it('checks the year and the counts the kind shows', () => {
		const form = {
			...emptyForm('anime', 'x'),
			year: '99',
			episodes: '2.5',
			duration: '5000',
			pages: 'abc'
		}

		expect(formErrors(form)).toEqual({ year: 'year', episodes: 'count', duration: 'duration' })
		expect(canSubmitForm(form)).toBe(false)
	})

	it('needs a name', () => {
		expect(canSubmitForm(emptyForm('anime', '   '))).toBe(false)
		expect(canSubmitForm(emptyForm('anime', 'Name'))).toBe(true)
	})
})

describe('formFromMedia', () => {
	it('reads a title back into the form it was made with', () => {
		const media = {
			media_ref: 'manual:0123456789abcdef0123',
			media_type: 'series',
			format: 'TV',
			status: 'FINISHED',
			title: { user_preferred: 'Show', english: 'Show', romaji: null, native: 'Шоу' },
			synonyms: ['A', 'B'],
			description: 'About',
			season_year: 2001,
			episodes: 6,
			duration: 45,
			genres: ['Drama'],
			studios: [],
			authors: []
		} as unknown as MediaDetails

		const form = formFromMedia(media)

		expect(form).toMatchObject({
			mediaType: 'series',
			title: 'Show',
			originalTitle: 'Шоу',
			synonyms: 'A\nB',
			year: '2001',
			episodes: '6',
			duration: '45',
			format: 'TV',
			status: 'FINISHED',
			genres: 'Drama'
		})

		expect(draftFromForm(form)).toEqual({
			media_type: 'series',
			title: 'Show',
			original_title: 'Шоу',
			description: 'About',
			format: 'TV',
			status: 'FINISHED',
			year: 2001,
			episodes: 6,
			duration: 45,
			synonyms: ['A', 'B'],
			genres: ['Drama']
		})
	})
})
