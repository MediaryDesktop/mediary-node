import { getApiProblems, HttpRequestError, problemDetail } from '@shared/api'
import { translate } from '@shared/i18n'

import {
	CODE_LENGTH,
	MAX_DISPLAY_NAME,
	MAX_EMAIL_LENGTH,
	MAX_PASSWORD_LENGTH,
	MIN_DISPLAY_NAME,
	MIN_PASSWORD_LENGTH
} from '../validation'

const SCHEMA_RULE: Record<string, () => string> = {
	display_name: () =>
		translate('auth.validation.nameLength', { min: MIN_DISPLAY_NAME, max: MAX_DISPLAY_NAME }),
	email: () => translate('auth.validation.emailTooLong', { max: MAX_EMAIL_LENGTH }),
	password: () =>
		translate('auth.validation.passwordLength', {
			min: MIN_PASSWORD_LENGTH,
			max: MAX_PASSWORD_LENGTH
		}),
	new_password: () =>
		translate('auth.validation.passwordLength', {
			min: MIN_PASSWORD_LENGTH,
			max: MAX_PASSWORD_LENGTH
		}),
	current_password: () => translate('auth.validation.passwordRequired'),
	confirmation: () => translate('auth.validation.confirmationMismatch'),
	code: () => translate('auth.validation.codeIncomplete', { length: CODE_LENGTH })
}

export function toAuthMessages(error: unknown): string[] {
	const failure = HttpRequestError.fromUnknown(error)

	if (failure.isOffline) {
		return [translate('auth.error.cloudUnreachable')]
	}

	const problems = getApiProblems(error)

	if (problems.length > 0) {
		return problems.map(problem =>
			problem.fromSchema
				? (SCHEMA_RULE[problem.field]?.() ??
					translate('auth.validation.fieldInvalid', { field: problem.field }))
				: problem.message
		)
	}

	return [problemDetail(failure, translate('auth.error.requestFailed'))]
}
