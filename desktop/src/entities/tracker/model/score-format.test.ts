import { describe, expect, it } from 'vitest'

import { formatScoreValue, nextScore } from './score-format'

describe('nextScore', () => {
	it('steps by whole points on a 100-point scale', () => {
		expect(nextScore(50, 'POINT_100', 1)).toBe(51)
		expect(nextScore(100, 'POINT_100', 1)).toBe(100)
		expect(nextScore(0, 'POINT_100', -1)).toBe(0)
	})

	it('steps by tenths on a 10-point scale', () => {
		expect(nextScore(70, 'POINT_10', 1)).toBe(80)
		expect(nextScore(0, 'POINT_10', 1)).toBe(10)
	})

	it('steps by fifths on a 5-star scale', () => {
		expect(nextScore(60, 'POINT_5', 1)).toBe(80)
		expect(nextScore(60, 'POINT_5', -1)).toBe(40)
	})

	it('cycles through the three smiley checkpoints', () => {
		expect(nextScore(0, 'POINT_3', 1)).toBe(35)
		expect(nextScore(35, 'POINT_3', 1)).toBe(60)
		expect(nextScore(60, 'POINT_3', 1)).toBe(100)
		expect(nextScore(100, 'POINT_3', 1)).toBe(100)
		expect(nextScore(60, 'POINT_3', -1)).toBe(35)
	})

	it('falls back to whole points for an unknown format', () => {
		expect(nextScore(50, 'MYSTERY', 1)).toBe(51)
	})
})

describe('formatScoreValue', () => {
	it('shows a dash for an unrated entry', () => {
		expect(formatScoreValue(0, 'POINT_100')).toBe('–')
	})

	it('formats each scale for display', () => {
		expect(formatScoreValue(87, 'POINT_100')).toBe('87')
		expect(formatScoreValue(87, 'POINT_10_DECIMAL')).toBe('8.7')
		expect(formatScoreValue(80, 'POINT_10')).toBe('8')
		expect(formatScoreValue(80, 'POINT_5')).toBe('4')
		expect(formatScoreValue(100, 'POINT_3')).toBe('😊')
		expect(formatScoreValue(60, 'POINT_3')).toBe('😐')
		expect(formatScoreValue(35, 'POINT_3')).toBe('😞')
	})
})
