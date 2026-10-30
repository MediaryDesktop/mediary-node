import { describe, expect, it } from 'vitest'

import { completeness, formatAfterTypeChange } from './draft'

describe('formatAfterTypeChange', () => {
	it('keeps a format the new kind accepts', () => {
		expect(formatAfterTypeChange('anime', 'OVA')).toBe('OVA')
		expect(formatAfterTypeChange('manga', 'NOVEL')).toBe('NOVEL')
	})

	it('drops a format the new kind would be refused with', () => {
		expect(formatAfterTypeChange('book', 'OVA')).toBeUndefined()
		expect(formatAfterTypeChange('movie', 'ONE_SHOT')).toBeUndefined()
	})

	it('leaves an empty format empty', () => {
		expect(formatAfterTypeChange('book', undefined)).toBeUndefined()
	})
})

describe('completeness', () => {
	const draft = { media_type: 'anime', title: 'Frieren' } as const

	it('counts the kind as filled once it is picked', () => {
		expect(completeness(draft, false).required.filled).toBe(2)
		expect(completeness(draft, false, true).required.filled).toBe(2)
	})

	it('does not count the placeholder kind before the user picks one', () => {
		const required = completeness(draft, false, false).required

		expect(required.filled).toBe(1)
		expect(required.total).toBe(4)
	})
})
