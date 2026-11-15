import { describe, expect, it } from 'vitest'

import { getApiProblems, HttpRequestError, problemCode, setupRequired } from './api-error'

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

describe('problemCode', () => {
	const typed = (type: string | undefined) =>
		new HttpRequestError('x', { status: 428, body: { detail: 'x', type } })

	it('reads the code the node names the failure by', () => {
		expect(problemCode(typed('urn:mediary:problem:books-folder-missing'))).toBe('books-folder-missing')
		expect(problemCode(typed('urn:mediary:problem:tool-missing'))).toBe('tool-missing')
	})

	it('has none for an unnamed failure, a plain type, or something that is not a response', () => {
		expect(problemCode(typed(undefined))).toBeNull()
		expect(problemCode(typed('about:blank'))).toBeNull()
		expect(problemCode(new HttpRequestError('x', { status: 428 }))).toBeNull()
		expect(problemCode(null)).toBeNull()
		expect(problemCode(new Error('offline'))).toBeNull()
	})
})

describe('setupRequired', () => {
	const setup = (detail?: string) =>
		new HttpRequestError('setup', {
			status: 428,
			body: { type: 'urn:mediary:problem:setup-required', detail }
		})

	it('names what the node wants set up first', () => {
		expect(setupRequired(setup('TMDB is not set up: add an API key in the settings'))).toBe(
			'TMDB is not set up: add an API key in the settings'
		)
	})

	it('is empty, not absent, when the node says nothing more', () => {
		expect(setupRequired(setup())).toBe('')
	})

	it('is not set off by any other 428, which a screen has no setup to offer for', () => {
		expect(
			setupRequired(
				new HttpRequestError('x', { status: 428, body: { detail: 'at most 5 repositories' } })
			)
		).toBeNull()
	})

	it('ignores any other failure', () => {
		expect(setupRequired(new HttpRequestError('gone', { status: 404, body: { detail: 'x' } }))).toBeNull()
		expect(setupRequired(null)).toBeNull()
		expect(setupRequired(new Error('offline'))).toBeNull()
	})
})
