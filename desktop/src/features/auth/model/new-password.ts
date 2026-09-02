import { combine, createEvent, createStore, sample } from 'effector'

import type { FieldErrors } from '@shared/api'
import { atom } from '@shared/factory'

import { completePasswordResetFx } from '@entities/session'

import { localFailure, toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'
import { validateCode, validatePassword } from '../lib/validation'

import { createField } from './field'

/**
 * Spending a reset code on a new password.
 *
 * The address is not a field: it comes from the link the previous step
 * navigated to, so it arrives with the submit event rather than living in a
 * store that would have to be kept in step with the route.
 */
export const newPasswordForm = atom(() => {
	const code = createField()
	const password = createField()

	/** Carries the address the code was mailed to. */
	const submitted = createEvent<string>()

	const failedLocally = createEvent<FieldErrors>()

	/** The password is changed and every session is gone, this one included. */
	const succeeded = createEvent()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine({ code: code.$value, password: password.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: (values, email) => {
			const problems: FieldErrors = {}

			const codeProblem = validateCode(values.code)
			// No display name to compare against here, and the address is the one
			// the code was mailed to — which is exactly what a password must not be.
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
