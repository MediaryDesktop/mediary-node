import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { completePasswordResetFx, requestPasswordResetFx } from '@entities/session'
import type { PasswordResetInput } from '@entities/session'

import { validateCode, validatePassword } from '../validation'

import { createAuthForm } from './form'

export const newPasswordForm = atom(() => {
	const succeeded = createEvent()

	const form = createAuthForm<'code' | 'password', PasswordResetInput, string>({
		fields: ['code', 'password'] as const,
		validate: (values, email) => [
			validateCode(values.code),
			validatePassword(values.password, email, '')
		],
		prepare: (values, email) => ({
			email,
			code: values.code.trim(),
			password: values.password
		}),
		submit: completePasswordResetFx,
		pending: completePasswordResetFx.pending,
		failure: completePasswordResetFx.failData
	})

	const $expiresAt = createStore<string | null>(null).on(
		requestPasswordResetFx.doneData,
		(_, accepted) => accepted.expires_at
	)

	sample({ clock: completePasswordResetFx.done, target: succeeded })

	return { ...form, succeeded, $expiresAt }
})
