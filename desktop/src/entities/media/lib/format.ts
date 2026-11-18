import type { TFunction } from 'i18next'

import type { MediaDate } from '../api/api'

export type MediaEnumGroup = 'format' | 'status' | 'season' | 'relation' | 'origin'

function humanizeEnum(value: string): string {
	const text = value.toLowerCase().replaceAll('_', ' ')
	return text.charAt(0).toUpperCase() + text.slice(1)
}

// A catalog enum ("SIDE_STORY") in the user's language; a value the locales do
// not know yet still reads as words ("Side story") rather than as a constant.
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

// The same buckets AniList colours its score badges by.
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

// As much of the date as the source knows: "2023", "Sep 2023" or "Sep 29, 2023".
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
