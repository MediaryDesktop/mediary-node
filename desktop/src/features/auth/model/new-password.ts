import { combine, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { completePasswordResetFx } from '@entities/session'

import { notifyFailure, notifyProblems } from '../lib'
import { validateCode, validatePassword } from '../validation'

import { createField } from './field'

export const newPasswordForm = atom(() => {
	const code = createField()
	const password = createField()

	const submitted = createEvent<string>()

	const succeeded = createEvent()

	const $values = combine({ code: code.$value, password: password.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: (values, email) => ({
			email,
			values,
			problems: [validateCode(values.code), validatePassword(values.password, email, '')].filter(
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
		fn: ({ email, values }) => ({
			email,
			code: values.code.trim(),
			password: values.password
		}),
		target: completePasswordResetFx
	})

	sample({ clock: completePasswordResetFx.done, target: succeeded })

	completePasswordResetFx.failData.watch(notifyFailure)

	return {
		code,
		password,
		submitted,
		succeeded,
		$pending: completePasswordResetFx.pending
	}
})
