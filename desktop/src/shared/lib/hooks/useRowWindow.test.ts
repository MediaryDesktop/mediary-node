import { describe, expect, it } from 'vitest'

import { rowWindow } from './useRowWindow'

const base = { count: 10_000, rowHeight: 36, viewport: 720, overscan: 10 }

describe('rowWindow', () => {
	it('renders the rows in view and a few either side, at the top', () => {
		expect(rowWindow({ ...base, scrollTop: 0 })).toEqual({
			start: 0,
			end: 30,
			before: 0,
			after: (10_000 - 30) * 36
		})
	})

	it('keeps the space of the rows above and below as padding', () => {
		const window = rowWindow({ ...base, scrollTop: 36 * 500 })

		expect(window).toEqual({ start: 490, end: 530, before: 490 * 36, after: (10_000 - 530) * 36 })
		expect(window.before + (window.end - window.start) * 36 + window.after).toBe(10_000 * 36)
	})

	it('stops at the end of the list', () => {
		const window = rowWindow({ ...base, scrollTop: 36 * 9_990 })

		expect(window.end).toBe(10_000)
		expect(window.after).toBe(0)
	})

	it('renders everything for a short list', () => {
		expect(rowWindow({ ...base, count: 5, scrollTop: 0 })).toEqual({
			start: 0,
			end: 5,
			before: 0,
			after: 0
		})
	})

	it('copes with a list that shrank under its scroll position', () => {
		const window = rowWindow({ ...base, count: 3, scrollTop: 36 * 500 })

		expect(window).toMatchObject({ start: 0, end: 3 })
		expect(window.before + (window.end - window.start) * 36 + window.after).toBe(3 * 36)
	})
})
