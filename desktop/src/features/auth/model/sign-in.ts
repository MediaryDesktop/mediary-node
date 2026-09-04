import { combine, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { notifyFailure, notifyProblems } from '../lib'
import { validateEmail, validatePasswordLength } from '../validation'

import { createField } from './field'

export const signInForm = atom(() => {
	const email = createField()
	const password = createField()
	const submitted = createEvent()

	const $values = combine({ email: email.$value, password: password.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => ({
			values,
			problems: [validateEmail(values.email), validatePasswordLength(values.password)].filter(
				(problem): problem is string => problem !== null
			)
		})
	})

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length > 0,
		fn: ({ problems }) => problems
	}).watch(notifyProblems)

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length === 0,
		fn: ({ values }) => ({ email: values.email.trim(), password: values.password }),
		target: sessionModel.signInRequested
	})

	sessionModel.signInFailed.watch(notifyFailure)

	return {
		email,
		password,
		submitted,
		$pending: sessionModel.$signInPending
	}
})
