import { createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { notifyFailure } from '../lib'
import { validateCode } from '../validation'

import { createAuthForm } from './form'

export const verifyEmailForm = atom(() => {
	const resent = createEvent()
	const mounted = createEvent()

	sample({
		clock: mounted,
		source: sessionModel.$verificationCodeSent,
		filter: sent => !sent,
		target: sessionModel.emailVerificationRequested
	})

	const form = createAuthForm({
		fields: ['code'] as const,
		validate: values => [validateCode(values.code)],
		prepare: values => ({ code: values.code.trim() }),
		submit: sessionModel.emailConfirmationRequested,
		pending: sessionModel.$emailConfirmationPending,
		failure: sessionModel.emailConfirmationFailed
	})

	sample({ clock: resent, target: sessionModel.emailVerificationRequested })
	sample({ clock: resent, fn: () => '', target: form.fields.code.changed })

	sessionModel.emailVerificationFailed.watch(notifyFailure)

	return {
		...form,
		resent,
		mounted,
		$expiresAt: sessionModel.$codeExpiresAt,
		$resendPending: sessionModel.$emailVerificationPending
	}
})
