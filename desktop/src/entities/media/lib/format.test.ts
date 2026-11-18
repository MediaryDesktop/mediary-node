import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'

import { enumLabel, formatMediaDate, scoreTone } from './format'

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
