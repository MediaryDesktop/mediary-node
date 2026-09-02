import { combine, createEvent, createStore, sample } from 'effector'

import type { FieldErrors } from '@shared/api'
import { atom } from '@shared/factory'

import { requestPasswordResetFx } from '@entities/session'

import { localFailure, toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'
import { validateEmail } from '../lib/validation'

import { createField } from './field'

/**
 * Asking for a reset code.
 *
 * The cloud answers the same way whether or not the address has an account, so
 * `sent` fires on any accepted request and the screen that listens must not
 * word it as "we found you" — the endpoint is deliberately unable to say so.
 */
export const resetPasswordForm = atom(() => {
	const email = createField()
	const submitted = createEvent()

	const failedLocally = createEvent<FieldErrors>()

	/** Carries the address, which the next step needs alongside the code. */
	const sent = createEvent<string>()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine({ email: email.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => {
			const problems: FieldErrors = {}
			const problem = validateEmail(values.email)

			if (problem) problems.email = problem

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
		fn: ({ values }) => ({ email: values.email.trim() }),
		target: requestPasswordResetFx
	})

	sample({ clock: requestPasswordResetFx.done, fn: ({ params }) => params.email, target: sent })

	$failure
		.on(failedLocally, (_, fields) => localFailure(fields))
		.on(requestPasswordResetFx.failData, (_, error) => toAuthFailure(error))
		.reset(submitted, email.changed)

	return {
		email,
		submitted,
		sent,
		$failure,
		$pending: requestPasswordResetFx.pending
	}
})
