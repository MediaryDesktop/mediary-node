import { combine, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'

import { createField } from './field'

export const signInForm = atom(() => {
	const email = createField()
	const password = createField()
	const submitted = createEvent()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine({ email: email.$value, password: password.$value })

	sample({
		clock: submitted,
		source: $values,
		fn: ({ email: value, password: secret }) => ({ email: value.trim(), password: secret }),
		target: sessionModel.signInRequested
	})

	$failure
		.on(sessionModel.signInFailed, (_, error) => toAuthFailure(error))
		.reset(submitted, sessionModel.authenticated, email.changed, password.changed)

	return {
		email,
		password,
		submitted,
		$failure,
		$pending: sessionModel.$signInPending
	}
})
