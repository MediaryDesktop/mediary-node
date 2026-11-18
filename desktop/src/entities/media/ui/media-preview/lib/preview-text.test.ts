import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { nextNumber, previewAction, previewFacts } from './preview-text'

const t = ((key: string, options?: Record<string, unknown>) =>
	options ? `${key}:${Object.values(options).join(',')}` : key) as unknown as TFunction

const SERIES = {
	reading: false,
	movie: false,
	statusLabel: 'Airing',
	seasons: 1,
	chapters: null,
	volumes: null,
	episodes: 12,
	duration: 24
}

describe('previewFacts', () => {
	it('lists status, length and runtime of something watched', () => {
		expect(previewFacts(t, SERIES)).toEqual([
			'Airing',
			'media.card.episodes:12',
			'media.card.minutesEach:24'
		])
		expect(previewFacts(t, { ...SERIES, seasons: 3 })).toContain('media.card.seasons:3')
	})

	it('gives a film no episode count', () => {
		expect(previewFacts(t, { ...SERIES, movie: true, statusLabel: null })).toEqual([
			'media.card.minutesEach:24'
		])
	})

	it('counts chapters, else volumes, of something read, and no runtime', () => {
		const manga = { ...SERIES, reading: true, chapters: 40, volumes: 5 }

		expect(previewFacts(t, manga)).toEqual(['Airing', 'media.card.chapters:40'])
		expect(previewFacts(t, { ...manga, chapters: null })).toEqual(['Airing', 'media.card.volumes:5'])
	})
})

describe('nextNumber', () => {
	it('is the one after the progress, never past the last', () => {
		expect(nextNumber(0, null)).toBe(1)
		expect(nextNumber(3, 12)).toBe(4)
		expect(nextNumber(12, 12)).toBe(12)
	})
})

describe('previewAction', () => {
	it('plays a series, opens a film, reads a known book', () => {
		expect(previewAction(t, { reading: false, movie: false, known: false, next: 2 })).toBe(
			'media.card.play:2'
		)
		expect(previewAction(t, { reading: false, movie: true, known: false, next: 2 })).toBe(
			'media.card.open'
		)
		expect(previewAction(t, { reading: true, movie: false, known: true, next: 5 })).toBe(
			'media.card.read:5'
		)
		expect(previewAction(t, { reading: true, movie: false, known: false, next: 1 })).toBe(
			'media.card.open'
		)
	})
})
