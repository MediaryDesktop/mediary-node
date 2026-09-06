import { atom } from '@shared/factory'

import { sessionModel } from '@entities/session'

import {
	normalizeDisplayName,
	validateDisplayName,
	validateEmail,
	validatePassword,
	validatePasswordConfirmation
} from '../validation'

import { createAuthForm } from './form'

export const signUpForm = atom(() =>
	createAuthForm({
		fields: ['display_name', 'email', 'password', 'confirmation'] as const,
		validate: values => [
			validateDisplayName(values.display_name),
			validateEmail(values.email),
			validatePassword(values.password, values.email, values.display_name),
			validatePasswordConfirmation(values.password, values.confirmation)
		],
		prepare: values => ({
			display_name: normalizeDisplayName(values.display_name),
			email: values.email.trim(),
			password: values.password
		}),
		submit: sessionModel.signUpRequested,
		pending: sessionModel.$signUpPending,
		failure: sessionModel.signUpFailed
	})
)
