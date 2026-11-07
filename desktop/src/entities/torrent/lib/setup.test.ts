import { describe, expect, it } from 'vitest'

import { isSetupIncomplete } from './setup'

const READY = { loaded: true, clientConfigured: true, clientReachable: true, hasSources: true }

describe('isSetupIncomplete', () => {
	it('is complete with a reachable client and somewhere to search', () => {
		expect(isSetupIncomplete(READY)).toBe(false)
		expect(isSetupIncomplete({ ...READY, clientReachable: null })).toBe(false)
	})

	it.each([
		['no client', { clientConfigured: false }],
		['an unreachable client', { clientReachable: false }],
		['no sources', { hasSources: false }]
	])('is incomplete with %s', (_, broken) => {
		expect(isSetupIncomplete({ ...READY, ...broken })).toBe(true)
	})

	it('says nothing before the setup has loaded', () => {
		expect(
			isSetupIncomplete({
				loaded: false,
				clientConfigured: false,
				clientReachable: false,
				hasSources: false
			})
		).toBe(false)
	})
})
