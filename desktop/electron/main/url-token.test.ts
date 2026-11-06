import { describe, expect, it } from 'vitest'

import { urlToken } from './url-token'

describe('urlToken', () => {
	// The node's test (server/internal/httpapi/middleware/auth_test.go) checks
	// the same vector: the shell and the node must agree on it.
	it('derives the same token as the node', () => {
		expect(urlToken('secret')).toBe('YC1QSADjGYnd-n8gi4Qt60AnFThGZfn6eCD1HpnoJtU')
	})

	it('is nothing without a node token', () => {
		expect(urlToken('')).toBe('')
	})
})
