import { describe, expect, it } from 'vitest'

import { supportsAutoDownload } from './supports'

describe('supportsAutoDownload', () => {
	it.each(['anilist:21', 'tmdb:movie:550', 'manual:7'])('offers rules for %s', ref => {
		expect(supportsAutoDownload(ref)).toBe(true)
	})

	it('offers none for a show numbered by season', () => {
		expect(supportsAutoDownload('tmdb:tv:1399')).toBe(false)
	})
})
