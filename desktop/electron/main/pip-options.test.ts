import { describe, expect, it } from 'vitest'

import { parseIntent, parseOpenOptions, parseSnapshot } from './pip-options.js'

describe('parseSnapshot', () => {
	it('keeps a position and whether it was playing', () => {
		expect(parseSnapshot({ position: 12.5, playing: true })).toEqual({ position: 12.5, playing: true })
	})

	it('treats anything but true as paused', () => {
		expect(parseSnapshot({ position: 3, playing: 'yes' })).toEqual({ position: 3, playing: false })
	})

	it('refuses a position that is not a real moment', () => {
		for (const position of [-1, Number.NaN, Infinity, '5', null]) {
			expect(parseSnapshot({ position, playing: true })).toBeNull()
		}

		expect(parseSnapshot(null)).toBeNull()
		expect(parseSnapshot('x')).toBeNull()
	})
})

describe('parseOpenOptions', () => {
	it('accepts a file with where to carry on and the shape of the picture', () => {
		expect(parseOpenOptions({ fileId: 7, position: 30, playing: false, aspect: 2.4 })).toEqual({
			fileId: 7,
			position: 30,
			playing: false,
			aspect: 2.4
		})
	})

	it('falls back to 16:9 for a shape that makes no sense', () => {
		for (const aspect of [0, -2, 100, Number.NaN, undefined]) {
			expect(parseOpenOptions({ fileId: 7, position: 0, playing: true, aspect })?.aspect).toBeCloseTo(
				16 / 9
			)
		}
	})

	it('refuses a file id that is not a positive whole number', () => {
		for (const fileId of [0, -3, 1.5, '7', undefined]) {
			expect(parseOpenOptions({ fileId, position: 0, playing: true, aspect: 1.7 })).toBeNull()
		}
	})
})

describe('parseIntent', () => {
	it('knows the three ways out', () => {
		expect(['mini', 'expand', 'stop'].map(parseIntent)).toEqual(['mini', 'expand', 'stop'])
	})

	it('refuses anything else', () => {
		expect(parseIntent('close')).toBeNull()
		expect(parseIntent(undefined)).toBeNull()
	})
})
