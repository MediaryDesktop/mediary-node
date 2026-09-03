import { getApiFieldErrors, HttpRequestError } from '@shared/api'
import type { FieldErrors } from '@shared/api'
import { translate } from '@shared/i18n'

export interface AuthFailure {
	message: string
	fields: FieldErrors
}

export function localFailure(fields: FieldErrors): AuthFailure {
	return { message: '', fields }
}

export function toAuthFailure(error: unknown): AuthFailure {
	const fields = getApiFieldErrors(error)
	const failure = HttpRequestError.fromUnknown(error)

	const message = failure.isOffline
		? translate('auth.error.cloudUnreachable')
		: (failure.body?.detail ?? translate('auth.error.requestFailed'))

	const covered = Object.values(fields).includes(message)

	return { message: covered ? '' : message, fields }
}
