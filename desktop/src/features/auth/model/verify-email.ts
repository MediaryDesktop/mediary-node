import { combine, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { notifyFailure, notifyProblems } from '../lib'
import { validateCode } from '../validation'

import { createField } from './field'

export const verifyEmailForm = atom(() => {
	const code = createField()
	const submitted = createEvent()
	const resent = createEvent()
	const mounted = createEvent()

	sample({
		clock: mounted,
		source: sessionModel.$verificationCodeSent,
		filter: sent => !sent,
		target: sessionModel.emailVerificationRequested
	})

	const $values = combine({ code: code.$value })

	const checked = sample({
		clock: submitted,
		source: $values,
		fn: values => ({ values, problems: [validateCode(values.code)].filter(Boolean) as string[] })
	})

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length > 0,
		fn: ({ problems }) => problems
	}).watch(notifyProblems)

	sample({
		clock: checked,
		filter: ({ problems }) => problems.length === 0,
		fn: ({ values }) => ({ code: values.code.trim() }),
		target: sessionModel.emailConfirmationRequested
	})

	sample({ clock: resent, target: sessionModel.emailVerificationRequested })

	sample({ clock: resent, fn: () => '', target: code.changed })

	sessionModel.emailConfirmationFailed.watch(notifyFailure)
	sessionModel.emailVerificationFailed.watch(notifyFailure)

	return {
		code,
		submitted,
		resent,
		mounted,
		$pending: sessionModel.$emailConfirmationPending,
		$resendPending: sessionModel.$emailVerificationPending
	}
})
