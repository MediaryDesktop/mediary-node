import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import { validateEmail, validatePasswordLength } from '../validation'

import { createAuthForm } from './form'

export const signInForm = atom(() =>
	createAuthForm({
		fields: ['email', 'password'] as const,
		validate: values => [validateEmail(values.email), validatePasswordLength(values.password)],
		prepare: values => ({ email: values.email.trim(), password: values.password }),
		submit: sessionModel.signInRequested,
		pending: sessionModel.$signInPending,
		failure: sessionModel.signInFailed
	})
)
