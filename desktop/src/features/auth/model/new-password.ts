import { combine, createEvent, createStore, sample } from 'effector'

import type { FieldErrors } from '@shared/api'
import { atom } from '@shared/factory'

import { completePasswordResetFx } from '@entities/session'

import { localFailure, toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'
import { validateCode, validatePassword } from '../lib/validation'

import { createField } from './field'

export const newPasswordForm = atom(() => {
	const code = createField()
	const password = createField()

	const submitted = createEvent<string>()

	const failedLocally = createEvent<FieldErrors>()

	const succeeded = createEvent()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine({ code: code.$value, password: password.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: (values, email) => {
			const problems: FieldErrors = {}

			const codeProblem = validateCode(values.code)

			const passwordProblem = validatePassword(values.password, email, '')

			if (codeProblem) problems.code = codeProblem
			if (passwordProblem) problems.password = passwordProblem

			return { email, values, problems }
		}
	})

	sample({
		clock: checked,
		filter: ({ problems }) => Object.keys(problems).length > 0,
		fn: ({ problems }) => problems,
		target: failedLocally
	})

	sample({
		clock: checked,
		filter: ({ problems }) => Object.keys(problems).length === 0,
		fn: ({ email, values }) => ({
			email,
			code: values.code.trim(),
			password: values.password
		}),
		target: completePasswordResetFx
	})

	sample({ clock: completePasswordResetFx.done, target: succeeded })

	$failure
		.on(failedLocally, (_, fields) => localFailure(fields))
		.on(completePasswordResetFx.failData, (_, error) => toAuthFailure(error))
		.reset(submitted, code.changed, password.changed)

	return {
		code,
		password,
		submitted,
		succeeded,
		$failure,
		$pending: completePasswordResetFx.pending
	}
})
