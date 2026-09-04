import { getApiFieldErrors, HttpRequestError } from '@shared/api'
import { translate } from '@shared/i18n'

const FIELD_LABEL: Record<string, () => string> = {
	display_name: () => translate('auth.field.name'),
	email: () => translate('auth.field.email'),
	password: () => translate('auth.field.password'),
	confirmation: () => translate('auth.field.confirmation'),
	code: () => translate('auth.field.code')
}

const REQUIRED = /required property/iu
const EMAIL_FORMAT = /email/iu
const MIN_LENGTH = /^expected length >= (\d+)/u
const MAX_LENGTH = /^expected length <= (\d+)/u

function label(field: string): string {
	return FIELD_LABEL[field]?.() ?? field
}

function readable(field: string, raw: string): string {
	if (REQUIRED.test(raw)) {
		return translate('auth.validation.fieldRequired', { field: label(field) })
	}

	if (field === 'email' && EMAIL_FORMAT.test(raw)) {
		return translate('auth.validation.emailInvalid')
	}

	const min = MIN_LENGTH.exec(raw)?.[1]

	if (min) {
		if (field === 'code') {
			return translate('auth.validation.codeIncomplete', { length: Number(min) })
		}

		if (field === 'password') {
			return translate('auth.validation.passwordTooShort', { min: Number(min) })
		}

		return translate('auth.validation.fieldTooShort', { field: label(field), min: Number(min) })
	}

	const max = MAX_LENGTH.exec(raw)?.[1]

	if (max) {
		if (field === 'password') {
			return translate('auth.validation.passwordTooLong', { max: Number(max) })
		}

		if (field === 'email') {
			return translate('auth.validation.emailTooLong', { max: Number(max) })
		}

		return translate('auth.validation.fieldTooLong', { field: label(field), max: Number(max) })
	}

	return translate('auth.validation.fieldInvalid', { field: label(field) })
}

export function toAuthMessages(error: unknown): string[] {
	const failure = HttpRequestError.fromUnknown(error)

	if (failure.isOffline) {
		return [translate('auth.error.cloudUnreachable')]
	}

	const fields = Object.entries(getApiFieldErrors(error))

	if (fields.length > 0) {
		return fields.map(([field, raw]) => readable(field, raw))
	}

	return [failure.body?.detail ?? translate('auth.error.requestFailed')]
}
