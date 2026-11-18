import { describe, expect, it } from 'vitest'

import { dateInputValue, parseDateInput, todayInputValue } from './date-input'

describe('date input', () => {
	it('writes a full date with padded month and day, nothing for a partial one', () => {
		expect(dateInputValue(2026, 3, 7)).toBe('2026-03-07')
		expect(dateInputValue(2026, 3, null)).toBe('')
		expect(dateInputValue(undefined, 3, 7)).toBe('')
	})

	it('reads back only a full date', () => {
		expect(parseDateInput('2026-03-07')).toEqual({ year: 2026, month: 3, day: 7 })
		expect(parseDateInput('')).toBeNull()
		expect(parseDateInput('2026-03')).toBeNull()
	})

	it('writes today in local time', () => {
		expect(todayInputValue(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
	})
})
