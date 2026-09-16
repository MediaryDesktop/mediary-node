import { describe, expect, it } from 'vitest'

import { formatRelative } from './lib'

describe('formatRelative', () => {
	const now = Date.parse('2026-09-15T12:00:00Z')

	it('picks the largest fitting unit', () => {
		expect(formatRelative('2026-09-18T12:00:00Z', 'en', now)).toBe('in 3 days')
		expect(formatRelative('2026-09-15T17:00:00Z', 'en', now)).toBe('in 5 hours')
		expect(formatRelative('2026-09-15T12:20:00Z', 'en', now)).toBe('in 20 minutes')
		expect(formatRelative('2026-09-15T12:00:10Z', 'en', now)).toBe('this minute')
	})
})
