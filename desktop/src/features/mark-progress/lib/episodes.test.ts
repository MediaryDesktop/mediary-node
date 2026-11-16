import { describe, expect, it } from 'vitest'

import { listableEpisode, watchedProgressPatch } from './episodes'

describe('watchedProgressPatch', () => {
	it('raises the list to an episode marked watched past it', () => {
		expect(watchedProgressPatch(7, true, { progress: 3, listed: true })).toEqual({ progress: 7 })
	})

	it('leaves the list alone for an episode already under it', () => {
		expect(watchedProgressPatch(2, true, { progress: 3, listed: true })).toBeNull()
		expect(watchedProgressPatch(5, false, { progress: 3, listed: true })).toBeNull()
	})

	it('lowers the list below an episode marked unwatched', () => {
		expect(watchedProgressPatch(2, false, { progress: 5, listed: true })).toEqual({ progress: 1 })
	})

	it('starts a title not on any list', () => {
		expect(watchedProgressPatch(1, true, { progress: 0, listed: false })).toEqual({
			status: 'CURRENT',
			progress: 1
		})
	})
})

describe('listableEpisode', () => {
	it('takes the numbers a list counts and nothing else', () => {
		expect(listableEpisode(12)).toBe(true)
		expect(listableEpisode(null)).toBe(false)
		expect(listableEpisode(0)).toBe(false)
		expect(listableEpisode(1.5)).toBe(false)
		expect(listableEpisode(300_005)).toBe(false)
	})
})
