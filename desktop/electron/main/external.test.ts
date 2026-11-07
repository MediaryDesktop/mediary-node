import { describe, expect, it } from 'vitest'

import { webAddress } from './external'

describe('webAddress', () => {
	it('lets a web page through', () => {
		expect(webAddress('https://nyaa.si/view/123')).toBe('https://nyaa.si/view/123')
		expect(webAddress('http://127.0.0.1:9117/jackett')).toBe('http://127.0.0.1:9117/jackett')
	})

	// Addresses an indexer or a plugin could hand back, each of which the OS
	// would act on rather than show.
	it.each([
		'file:///C:/Windows/System32/calc.exe',
		'file://\\\\attacker\\share\\setup.exe',
		'search-ms:query=setup&crumb=location:\\\\attacker\\share',
		'ms-msdt:/id PCWDiagnostic',
		'javascript:alert(1)',
		'smb://attacker/share',
		'mailto:someone@example.com',
		'https://user:secret@example.com/',
		'not a url',
		''
	])('refuses %s', raw => {
		expect(webAddress(raw)).toBeNull()
	})
})
