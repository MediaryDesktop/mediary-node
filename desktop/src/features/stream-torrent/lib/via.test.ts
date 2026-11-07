import { describe, expect, it } from 'vitest'

import { effectiveVia } from './via'

describe('effectiveVia', () => {
	it('keeps the choice while a debrid service is set up', () => {
		expect(effectiveVia('debrid', true)).toBe('debrid')
		expect(effectiveVia('embedded', true)).toBe('embedded')
	})

	it('streams through the node without one', () => {
		expect(effectiveVia('debrid', false)).toBe('embedded')
	})
})
