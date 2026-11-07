import { describe, expect, it } from 'vitest'

import { nodeBanner } from './banner'

const calm = { lasted: false, retrying: false }

describe('nodeBanner', () => {
	it('says nothing while the node runs, or after the app stopped it', () => {
		expect(nodeBanner('ready', calm)).toBe('none')
		expect(nodeBanner('stopped', calm)).toBe('none')
	})

	it('lets a quick restart pass unremarked, and mentions one that drags on', () => {
		expect(nodeBanner('restarting', calm)).toBe('none')
		expect(nodeBanner('restarting', { ...calm, lasted: true })).toBe('recovering')
		expect(nodeBanner('starting', { ...calm, lasted: true })).toBe('recovering')
	})

	it('shows a node given up on at once', () => {
		expect(nodeBanner('failed', calm)).toBe('failed')
	})

	it('keeps the failure in view while the user’s retry is under way, until the node is back', () => {
		expect(nodeBanner('starting', { lasted: true, retrying: true })).toBe('failed')
		expect(nodeBanner('ready', { lasted: false, retrying: true })).toBe('none')
	})
})
