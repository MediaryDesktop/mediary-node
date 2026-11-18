import { describe, expect, it } from 'vitest'

import { statusListId, statusOfListId } from './statuses'

describe('status lists', () => {
	it('round-trips a status through its list id', () => {
		expect(statusOfListId(statusListId('PLANNING'))).toBe('PLANNING')
	})

	it('reads no status from a list of the user or an unknown one', () => {
		expect(statusOfListId('3f2a')).toBeNull()
		expect(statusOfListId('status:SLEEPING')).toBeNull()
	})
})
