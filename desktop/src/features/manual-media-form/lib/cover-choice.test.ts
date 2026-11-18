import { describe, expect, it } from 'vitest'

import type { CoverSelection } from './cover'
import { coverFound, coverLost, NO_COVER_CHOICE } from './cover-choice'

const POSTER: CoverSelection = { kind: 'url', value: 'big.jpg', previewUrl: 'small.jpg', source: 'search' }
const OWN: CoverSelection = { kind: 'url', value: 'mine.jpg', previewUrl: 'mine.jpg', source: 'url' }

describe('cover choice', () => {
	it('puts the found poster in when there is no cover, as the assistant’s', () => {
		expect(coverFound(NO_COVER_CHOICE, POSTER)).toEqual({ selection: POSTER, automatic: true })
	})

	it('replaces the assistant’s own poster with a newer one', () => {
		const automatic = { selection: POSTER, automatic: true }
		const newer: CoverSelection = { ...POSTER, value: 'newer.jpg' }

		expect(coverFound(automatic, newer)).toEqual({ selection: newer, automatic: true })
	})

	it('keeps the cover the user picked while the search ran, and keeps it theirs', () => {
		const picked = { selection: OWN, automatic: false }
		const afterSearch = coverFound(picked, POSTER)

		expect(afterSearch).toEqual(picked)
		expect(coverLost(afterSearch)).toEqual(picked)
	})

	it('drops only the assistant’s poster', () => {
		expect(coverLost({ selection: POSTER, automatic: true })).toEqual(NO_COVER_CHOICE)
		expect(coverLost({ selection: OWN, automatic: false })).toEqual({ selection: OWN, automatic: false })
	})
})
