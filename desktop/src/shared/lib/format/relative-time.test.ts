import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relative-time'

describe('formatRelativeTime', () => {
	const now = Date.parse('2026-09-15T12:00:00Z')

	it('picks the largest fitting unit', () => {
		expect(formatRelativeTime('2026-10-20T12:00:00Z', 'en', { now })).toBe('next month')
		expect(formatRelativeTime('2026-09-25T12:00:00Z', 'en', { now })).toBe('next week')
		expect(formatRelativeTime('2026-09-15T17:00:00Z', 'en', { now })).toBe('in 5 hours')
		expect(formatRelativeTime('2026-09-15T12:00:10Z', 'en', { now })).toBe('this minute')
	})

	it('stops at the coarsest unit the caller allows', () => {
		expect(formatRelativeTime('2026-09-25T12:00:00Z', 'en', { now, maxUnit: 'day' })).toBe('in 10 days')
		expect(formatRelativeTime('2026-09-18T12:00:00Z', 'en', { now, maxUnit: 'day' })).toBe('in 3 days')
		expect(formatRelativeTime('2026-09-15T12:20:00Z', 'en', { now, maxUnit: 'day' })).toBe(
			'in 20 minutes'
		)
	})

	it('accepts a Date and reports nothing for an unparsable value', () => {
		expect(formatRelativeTime(new Date('2026-09-15T17:00:00Z'), 'en', { now })).toBe('in 5 hours')
		expect(formatRelativeTime('not a date', 'en', { now })).toBe('')
	})
})
