import { describe, expect, it } from 'vitest'

import { readProgress, readProgressPatch } from './chapters'

describe('chapter progress', () => {
	it('marks a chapter read by moving progress up to it, and unread by moving it below', () => {
		expect(readProgress('7', true, 3)).toBe(7)
		expect(readProgress('7', false, 10)).toBe(6)
		expect(readProgress('1', false, 1)).toBe(0)
	})

	it('puts a title not on any list on "reading" when a chapter of it is marked', () => {
		expect(readProgressPatch('7', true, { progress: 3, listed: true })).toEqual({ progress: 7 })
		expect(readProgressPatch('7', true, { progress: 0, listed: false })).toEqual({
			status: 'CURRENT',
			progress: 7
		})
		expect(readProgressPatch('7', true, { progress: 10, listed: false })).toBeNull()
	})

	it('changes nothing for a chapter already where it is marked, or an extra', () => {
		expect(readProgress('7', true, 10)).toBeNull()
		expect(readProgress('7', false, 3)).toBeNull()
		expect(readProgress('12.5', true, 3)).toBeNull()
		expect(readProgress('0', true, 3)).toBeNull()
		expect(readProgress(null, true, 3)).toBeNull()
	})
})
