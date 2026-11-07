import { describe, expect, it } from 'vitest'

import { bodyOf, canSubmit, checkParamsOf, fieldsOf } from './form'

const SAVED = { id: 3, name: 'Jackett', url: 'http://localhost:9117/torznab', has_api_key: true } as never

describe('Torznab source form', () => {
	it('keeps a stored key when the field is left empty', () => {
		const fields = fieldsOf(SAVED)

		expect(bodyOf(fields, SAVED)).toEqual({
			name: 'Jackett',
			url: 'http://localhost:9117/torznab',
			api_key: undefined
		})
		expect(checkParamsOf(fields, SAVED)).toEqual({
			source_id: 3,
			url: 'http://localhost:9117/torznab',
			api_key: undefined
		})
	})

	it('sends a typed key, and an empty one for a new source', () => {
		expect(bodyOf({ ...fieldsOf(SAVED), apiKey: 'k' }, SAVED).api_key).toBe('k')
		expect(bodyOf({ name: 'J', url: 'http://x', apiKey: '' }, null).api_key).toBe('')
	})

	it('needs a name and an address', () => {
		expect(canSubmit({ name: 'J', url: 'http://x', apiKey: '' })).toBe(true)
		expect(canSubmit({ name: '', url: 'http://x', apiKey: '' })).toBe(false)
	})
})
