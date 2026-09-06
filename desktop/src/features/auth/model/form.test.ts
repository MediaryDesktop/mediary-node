import { createEvent, createStore } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAuthForm } from './form'

const toasts = vi.hoisted(() => ({ error: vi.fn() }))

vi.mock('@shared/ui', () => ({ toast: toasts }))
vi.mock('@shared/i18n', () => ({ translate: (key: string) => key }))

describe('createAuthForm', () => {
	beforeEach(() => {
		toasts.error.mockClear()
	})

	it('submits a prepared payload when every validator passes', () => {
		const submit = createEvent<{ email: string }>()
		const received: { email: string }[] = []

		submit.watch(payload => received.push(payload))

		const form = createAuthForm({
			fields: ['email'] as const,
			validate: () => [null],
			prepare: values => ({ email: values.email.trim() }),
			submit,
			pending: createStore(false)
		})

		form.fields.email.changed('  someone@example.test  ')
		form.submitted()

		expect(received).toEqual([{ email: 'someone@example.test' }])
	})

	it('reports every problem and submits nothing when a validator complains', () => {
		const submit = createEvent<unknown>()
		const submitted = vi.fn()

		submit.watch(submitted)

		const form = createAuthForm({
			fields: ['email', 'password'] as const,
			validate: () => ['bad email', 'bad password'],
			prepare: values => values,
			submit,
			pending: createStore(false)
		})

		form.submitted()

		expect(submitted).not.toHaveBeenCalled()
		expect(toasts.error).toHaveBeenCalledTimes(2)
	})

	it('passes the submit context to both the validators and the payload', () => {
		const submit = createEvent<{ email: string; code: string }>()
		const received: { email: string; code: string }[] = []
		const seen: string[] = []

		submit.watch(payload => received.push(payload))

		const form = createAuthForm<'code', { email: string; code: string }, string>({
			fields: ['code'] as const,
			validate: (_values, email) => {
				seen.push(email)
				return [null]
			},
			prepare: (values, email) => ({ email, code: values.code }),
			submit,
			pending: createStore(false)
		})

		form.fields.code.changed('123456')
		form.submitted('owner@example.test')

		expect(seen).toEqual(['owner@example.test'])
		expect(received).toEqual([{ email: 'owner@example.test', code: '123456' }])
	})
})
