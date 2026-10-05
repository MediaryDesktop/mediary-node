import { describe, expect, it } from 'vitest'

import { localRef, routeRef } from './refs'

describe('routeRef', () => {
	it('reads a bare file id as a library file', () => {
		expect(routeRef('42')).toBe('local:42')
		expect(localRef(42)).toBe('local:42')
	})

	it('passes any other reference through for the node to judge', () => {
		expect(routeRef('local:42')).toBe('local:42')
		expect(routeRef('mangadex:a1b2')).toBe('mangadex:a1b2')
		expect(routeRef('042')).toBe('042')
	})
})
