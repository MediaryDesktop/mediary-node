import { describe, expect, it } from 'vitest'

import { bodyOf, canSubmit, checkParamsOf, fieldsOf } from './form'

const SAVED = { id: 7, name: 'Komga', url: 'http://nas/opds', username: 'me', has_password: true }

describe('OPDS server form', () => {
	it('starts from the saved server, without its password', () => {
		expect(fieldsOf(SAVED)).toEqual({
			name: 'Komga',
			url: 'http://nas/opds',
			username: 'me',
			password: ''
		})
		expect(fieldsOf(null)).toEqual({ name: '', url: '', username: '', password: '' })
	})

	it('keeps a stored password when the field is left empty', () => {
		const fields = fieldsOf(SAVED)

		expect(bodyOf(fields, SAVED)).not.toHaveProperty('password', '')
		expect(bodyOf(fields, SAVED).password).toBeUndefined()
		expect(checkParamsOf(fields, SAVED)).toEqual({
			server_id: 7,
			url: 'http://nas/opds',
			username: 'me',
			password: undefined
		})
	})

	it('sends an empty password for a new server, and a typed one always', () => {
		expect(bodyOf(fieldsOf(null), null).password).toBe('')
		expect(bodyOf({ ...fieldsOf(SAVED), password: 'new' }, SAVED).password).toBe('new')
	})

	it('needs a name and an address', () => {
		expect(canSubmit({ name: 'Komga', url: 'http://nas', username: '', password: '' })).toBe(true)
		expect(canSubmit({ name: '  ', url: 'http://nas', username: '', password: '' })).toBe(false)
		expect(canSubmit({ name: 'Komga', url: '', username: '', password: '' })).toBe(false)
	})
})
