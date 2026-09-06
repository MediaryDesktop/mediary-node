import { createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import { requestPasswordResetFx } from '@entities/session'

import { validateEmail } from '../validation'

import { createAuthForm } from './form'

export const resetPasswordForm = atom(() => {
	const sent = createEvent<string>()

	const form = createAuthForm({
		fields: ['email'] as const,
		validate: values => [validateEmail(values.email)],
		prepare: values => ({ email: values.email.trim() }),
		submit: requestPasswordResetFx,
		pending: requestPasswordResetFx.pending,
		failure: requestPasswordResetFx.failData
	})

	sample({ clock: requestPasswordResetFx.done, fn: ({ params }) => params.email, target: sent })

	return { ...form, sent }
})
