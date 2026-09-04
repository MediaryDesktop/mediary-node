import { combine, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { notifyFailure, notifyProblems } from '../lib'
import {
	normalizeDisplayName,
	validateDisplayName,
	validateEmail,
	validatePassword,
	validatePasswordConfirmation
} from '../validation'

import { createField } from './field'

interface SignUpValues {
	display_name: string
	email: string
	password: string
	confirmation: string
}

function check(values: SignUpValues): string[] {
	return [
		validateDisplayName(values.display_name),
		validateEmail(values.email),
		validatePassword(values.password, values.email, values.display_name),
		validatePasswordConfirmation(values.password, values.confirmation)
	].filter((problem): problem is string => problem !== null)
}

export const signUpForm = atom(() => {
	const name = createField()
	const email = createField()
	const password = createField()
	const confirmation = createField()
	const submitted = createEvent()

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
		filter: ({ problems }) => problems.length > 0,
		fn: ({ problems }) => problems
	}).watch(notifyProblems)

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length === 0,
		fn: ({ values }) => ({
			display_name: normalizeDisplayName(values.display_name),
			email: values.email.trim(),
			password: values.password
		}),
		target: sessionModel.signUpRequested
	})

	sessionModel.signUpFailed.watch(notifyFailure)

	return {
		name,
		email,
		password,
		confirmation,
		submitted,
		$pending: sessionModel.$signUpPending
	}
})
