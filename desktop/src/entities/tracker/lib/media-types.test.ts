import { describe, expect, it } from 'vitest'

import { canTrack } from './media-types'

describe('canTrack', () => {
	it('needs AniList for anime and manga only', () => {
		expect(canTrack('anime', false)).toBe(false)
		expect(canTrack('manga', true)).toBe(true)
		expect(canTrack('movie', false)).toBe(true)
		expect(canTrack('dorama', false)).toBe(true)
		expect(canTrack('book', false)).toBe(true)
		expect(canTrack('podcast', true)).toBe(false)
	})
})
