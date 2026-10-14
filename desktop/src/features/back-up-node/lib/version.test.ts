import { describe, expect, it } from 'vitest'

import { isOlderThan } from './version'

describe('isOlderThan', () => {
	it('compares major, minor and patch in order', () => {
		expect(isOlderThan('1.2.0', '1.4.0')).toBe(true)
		expect(isOlderThan('1.4.0', '1.4.0')).toBe(false)
		expect(isOlderThan('1.10.0', '1.9.3')).toBe(false)
		expect(isOlderThan('0.9.9', '1.0.0')).toBe(true)
		expect(isOlderThan('2.0.0', '1.99.99')).toBe(false)
	})

	it('ignores a leading v and a pre-release or build tail', () => {
		expect(isOlderThan('v1.2.0-dev', '1.3.0')).toBe(true)
		expect(isOlderThan('1.3.0+abc', 'v1.3.0')).toBe(false)
	})

	it('never blocks on a version it cannot read', () => {
		expect(isOlderThan('0.0.0-e2e', 'garbage')).toBe(false)
		expect(isOlderThan('dev', '1.0.0')).toBe(false)
	})
})
