import { combine, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { requestPasswordResetFx } from '@entities/session'

import { notifyFailure, notifyProblems } from '../lib'
import { validateEmail } from '../validation'

import { createField } from './field'

export const resetPasswordForm = atom(() => {
	const email = createField()
	const submitted = createEvent()

	const sent = createEvent<string>()

	const $values = combine({ email: email.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => ({ values, problems: [validateEmail(values.email)].filter(Boolean) as string[] })
	})

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length > 0,
		fn: ({ problems }) => problems
	}).watch(notifyProblems)

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length === 0,
		fn: ({ values }) => ({ email: values.email.trim() }),
		target: requestPasswordResetFx
	})

	sample({ clock: requestPasswordResetFx.done, fn: ({ params }) => params.email, target: sent })

	requestPasswordResetFx.failData.watch(notifyFailure)

	return {
		email,
		submitted,
		sent,
		$pending: requestPasswordResetFx.pending
	}
})
