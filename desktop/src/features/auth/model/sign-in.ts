import { combine, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'

import { createField } from './field'

/**
 * The sign-in form: field state, and the shape of a rejection.
 *
 * The credential check itself belongs to `entities/session`; this model only
 * collects what the user typed and reads back what went wrong. Sign-in
 * deliberately skips the local rules registration applies — an account created
 * before a rule changed must still be able to get in, and "your password is too
 * short" on a sign-in form tells an attacker which half of the pair was wrong.
 */
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
		// Cleared on anything that makes the old complaint stale: a new attempt,
		// a success, or the user editing the input it was about.
		.reset(submitted, sessionModel.authenticated, email.changed, password.changed)

	return {
		email,
		password,
		submitted,
		$failure,
		$pending: sessionModel.$signInPending
	}
})
