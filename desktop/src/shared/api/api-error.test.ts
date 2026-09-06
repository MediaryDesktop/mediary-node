import { describe, expect, it } from 'vitest'

import { getApiProblems, HttpRequestError } from './api-error'

function problem(errors: { message: string; location: string }[]) {
	return new HttpRequestError('rejected', {
		status: 422,
		body: { detail: 'rejected', errors }
	})
}

describe('getApiProblems', () => {
	it('marks a body-scoped location as a schema violation', () => {
		const [first] = getApiProblems(
			problem([{ location: 'body.password', message: 'expected length >= 10' }])
		)

		expect(first).toEqual({
			field: 'password',
			message: 'expected length >= 10',
			fromSchema: true
		})
	})

	it('marks an unprefixed location as the service speaking for itself', () => {
		const [first] = getApiProblems(
			problem([{ location: 'password', message: 'password must not repeat your email' }])
		)

		expect(first).toEqual({
			field: 'password',
			message: 'password must not repeat your email',
			fromSchema: false
		})
	})

	it('keeps the first complaint per field and drops nested paths', () => {
		const problems = getApiProblems(
			problem([
				{ location: 'body.email', message: 'first' },
				{ location: 'body.email', message: 'second' },
				{ location: 'body.items[0].name', message: 'nested' }
			])
		)

		expect(problems).toEqual([{ field: 'email', message: 'first', fromSchema: true }])
	})

	it('finds nothing in an error that carries no problem body', () => {
		expect(getApiProblems(new Error('offline'))).toEqual([])
	})
})
