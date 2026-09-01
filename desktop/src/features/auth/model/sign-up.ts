import { combine, createEvent, createStore, sample } from 'effector'

import type { FieldErrors } from '@shared/api'
import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { localFailure, toAuthFailure } from '../lib/failure'
import type { AuthFailure } from '../lib/failure'
import {
	normalizeDisplayName,
	validateDisplayName,
	validateEmail,
	validatePassword,
	validatePasswordConfirmation
} from '../lib/validation'

import { createField } from './field'

interface SignUpValues {
	display_name: string
	email: string
	password: string
	confirmation: string
}

/** The local pass, keyed the same way the server keys its own complaints. */
function check(values: SignUpValues): FieldErrors {
	const fields: FieldErrors = {}

	const name = validateDisplayName(values.display_name)
	const email = validateEmail(values.email)
	const password = validatePassword(values.password, values.email, values.display_name)
	const confirmation = validatePasswordConfirmation(values.password, values.confirmation)

	if (name) fields.display_name = name
	if (email) fields.email = email
	if (password) fields.password = password
	if (confirmation) fields.confirmation = confirmation

	return fields
}

/**
 * The registration form.
 *
 * Validation runs here before the request goes out, and the server validates
 * everything again — its answer wins. The local pass exists so a typo costs no
 * round trip, and the limits are copied exactly on purpose (see lib/validation).
 */
export const signUpForm = atom(() => {
	const name = createField()
	const email = createField()
	const password = createField()
	const confirmation = createField()
	const submitted = createEvent()

	const failedLocally = createEvent<FieldErrors>()

	const $failure = createStore<AuthFailure | null>(null)
	const $values = combine<SignUpValues>({
		display_name: name.$value,
		email: email.$value,
		password: password.$value,
		confirmation: confirmation.$value
	})

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => ({ values, problems: check(values) })
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
		fn: ({ values }) => ({
			display_name: normalizeDisplayName(values.display_name),
			email: values.email.trim(),
			password: values.password
		}),
		target: sessionModel.signUpRequested
	})

	$failure
		.on(failedLocally, (_, fields) => localFailure(fields))
		.on(sessionModel.signUpFailed, (_, error) => toAuthFailure(error))
		.reset(
			submitted,
			sessionModel.authenticated,
			name.changed,
			email.changed,
			password.changed,
			confirmation.changed
		)

	return {
		name,
		email,
		password,
		confirmation,
		submitted,
		$failure,
		$pending: sessionModel.$signUpPending
	}
})
