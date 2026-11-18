import { describe, expect, it } from 'vitest'

import { formatProgress, preferredTitle } from './format'

describe('tracker formatting', () => {
	it('shows a total only when the source knows it', () => {
		expect(formatProgress(3, 12)).toBe('3 / 12')
		expect(formatProgress(3, null)).toBe('3')
	})

	it('prefers the title the user chose on AniList', () => {
		expect(
			preferredTitle({ user_preferred: null, english: 'Frieren', romaji: 'Sousou', native: null })
		).toBe('Frieren')
	})
})
