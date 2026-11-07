import { describe, expect, it } from 'vitest'

import { angleToValue, MAX, MIN, outOfTen, scoreColor, START_ANGLE, SWEEP, valueToAngle } from './dial'

describe('score dial', () => {
	it('maps the ends of the arc to the ends of the scale', () => {
		expect(valueToAngle(MIN)).toBe(START_ANGLE)
		expect(valueToAngle(MAX)).toBe(START_ANGLE + SWEEP)
		expect(angleToValue(START_ANGLE)).toBe(MIN)
		expect(angleToValue(START_ANGLE + SWEEP)).toBe(MAX)
	})

	it('turns an angle back into the value it came from', () => {
		for (const value of [0, 1, 37, 50, 82, 99, 100]) {
			expect(angleToValue(valueToAngle(value))).toBe(value)
		}
	})

	it('snaps a pointer in the gap to the nearer end', () => {
		const gapMiddle = START_ANGLE + SWEEP + (360 - SWEEP) / 2

		expect(angleToValue(gapMiddle - 1)).toBe(MAX)
		expect(angleToValue(gapMiddle + 1)).toBe(MIN)
	})

	it('keeps values off the scale on it', () => {
		expect(valueToAngle(-20)).toBe(valueToAngle(MIN))
		expect(valueToAngle(140)).toBe(valueToAngle(MAX))
	})

	it('shows a stored score out of ten', () => {
		expect(outOfTen(85)).toBe(8.5)
		expect(outOfTen(100)).toBe(10)
	})

	it('colours each end of the scale with its own stop', () => {
		expect(scoreColor(0)).toBe('color-mix(in srgb, #F97316 0%, #DC2626)')
		expect(scoreColor(100)).toBe('color-mix(in srgb, #15803D 100%, #22C55E)')
	})
})
