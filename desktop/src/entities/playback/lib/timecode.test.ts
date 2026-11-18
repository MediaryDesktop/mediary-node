import { describe, expect, it } from 'vitest'

import { formatTimecode } from './timecode'

describe('formatTimecode', () => {
	it('reads as a timecode', () => {
		expect(formatTimecode(0)).toBe('0:00')
		expect(formatTimecode(65)).toBe('1:05')
		expect(formatTimecode(3725)).toBe('1:02:05')
	})

	it('survives what the player has not reported yet', () => {
		expect(formatTimecode(Number.NaN)).toBe('0:00')
		expect(formatTimecode(-5)).toBe('0:00')
	})
})
