import { combine, createEvent, createStore, sample } from 'effector'

import type { FieldErrors } from '@shared/api'
import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { localFailure, toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'
import { validateCode } from '../lib/validation'

import { createField } from './field'

export const verifyEmailForm = atom(() => {
	const code = createField()
	const submitted = createEvent()
	const resent = createEvent()

	const failedLocally = createEvent<FieldErrors>()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine({ code: code.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => {
			const problems: FieldErrors = {}
			const problem = validateCode(values.code)

			if (problem) problems.code = problem

			return { values, problems }
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
		fn: ({ values }) => ({ code: values.code.trim() }),
		target: sessionModel.emailConfirmationRequested
	})

	sample({ clock: resent, target: sessionModel.emailVerificationRequested })

	sample({ clock: resent, fn: () => '', target: code.changed })

	$failure
		.on(failedLocally, (_, fields) => localFailure(fields))
		.on([sessionModel.emailConfirmationFailed, sessionModel.emailVerificationFailed], (_, error) =>
			toAuthFailure(error)
		)
		.reset(submitted, resent, code.changed, sessionModel.emailVerified)

	return {
		code,
		submitted,
		resent,
		$failure,
		$pending: sessionModel.$emailConfirmationPending,
		$resendPending: sessionModel.$emailVerificationPending
	}
})
