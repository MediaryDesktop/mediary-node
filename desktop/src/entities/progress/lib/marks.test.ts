import { describe, expect, it } from 'vitest'

import type { TitleProgress } from '../api/api'

import { NO_MARKS, titleMarks } from './marks'

const at = '2026-11-16T20:00:00Z'

const progress: TitleProgress = {
	media_ref: 'anilist:154587',
	episodes: [
		{ episode: 1, position: 1400, duration: 1420, watched: true, watch_count: 1, updated_at: at },
		{ episode: 3, position: 710, duration: 1420, watched: false, watch_count: 0, updated_at: at },
		{ episode: 4, position: 300, duration: 0, watched: false, watch_count: 0, updated_at: at }
	],
	chapters: [
		{ chapter: '12.5', page: 39, pages: 40, read: true, updated_at: at },
		{ chapter: '13', page: 4, pages: 40, read: false, updated_at: at }
	]
}

describe('titleMarks', () => {
	it('marks the episodes watched and how far into the begun ones', () => {
		const marks = titleMarks(progress, 'anilist:154587')

		expect([...marks.watched]).toEqual([1])
		expect(marks.started.get(3)).toBe(0.5)
		// Without a length there is no telling how far in it is.
		expect(marks.started.has(4)).toBe(false)
	})

	it('marks the chapters read by number, extras included', () => {
		expect([...titleMarks(progress, 'anilist:154587').read]).toEqual([12.5])
	})

	it('marks nothing from another title', () => {
		expect(titleMarks(progress, 'anilist:1')).toBe(NO_MARKS)
		expect(titleMarks(null, 'anilist:1')).toBe(NO_MARKS)
	})
})
