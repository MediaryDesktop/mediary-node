import { describe, expect, it } from 'vitest'

import { queryPhase } from './phase'

const isEmpty = (items: string[]) => items.length === 0

describe('queryPhase', () => {
	it('is loading until there is an answer', () => {
		expect(queryPhase({ data: null, failed: false })).toBe('loading')
		expect(queryPhase({ data: undefined, failed: false, isEmpty })).toBe('loading')
	})

	it('shows a failure without data as a failure, not as an empty list', () => {
		expect(queryPhase({ data: null, failed: true, isEmpty })).toBe('failed')
	})

	it('keeps what it has through a failed refresh', () => {
		expect(queryPhase({ data: ['a'], failed: true, isEmpty })).toBe('ready')
	})

	it('tells an empty answer from a full one', () => {
		expect(queryPhase({ data: [], failed: false, isEmpty })).toBe('empty')
		expect(queryPhase({ data: ['a'], failed: false, isEmpty })).toBe('ready')
		expect(queryPhase({ data: [], failed: false })).toBe('ready')
	})
})
