import { translate } from '@shared/i18n'

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128
export const MIN_DISPLAY_NAME = 2
export const MAX_DISPLAY_NAME = 40
export const MAX_EMAIL_LENGTH = 254
export const CODE_LENGTH = 6

export const CODE_TTL_SECONDS = 30 * 60

export function normalizeDisplayName(raw: string): string {
	return raw.trim().split(/\s+/u).join(' ')
}

export function validateEmail(raw: string): string | null {
	const value = raw.trim()

	if (!value) {
		return translate('auth.validation.emailRequired')
	}

	if (value.length > MAX_EMAIL_LENGTH) {
		return translate('auth.validation.emailTooLong', { max: MAX_EMAIL_LENGTH })
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
		return translate('auth.validation.emailInvalid')
	}

	return null
}

export function validateDisplayName(raw: string): string | null {
	const value = normalizeDisplayName(raw)

	if (!value) {
		return translate('auth.validation.nameRequired')
	}

	const length = [...value].length

	if (length < MIN_DISPLAY_NAME || length > MAX_DISPLAY_NAME) {
		return translate('auth.validation.nameLength', { min: MIN_DISPLAY_NAME, max: MAX_DISPLAY_NAME })
	}

	return null
}

export function validatePassword(password: string, email: string, displayName: string): string | null {
	const length = [...password].length

	if (length < MIN_PASSWORD_LENGTH) {
		return translate('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
	}

	if (length > MAX_PASSWORD_LENGTH) {
		return translate('auth.validation.passwordTooLong', { max: MAX_PASSWORD_LENGTH })
	}

	const localPart = email.split('@')[0] ?? ''
	const equalsIgnoringCase = (other: string) =>
		other.length > 0 && password.toLowerCase() === other.trim().toLowerCase()

	if (equalsIgnoringCase(email) || equalsIgnoringCase(localPart) || equalsIgnoringCase(displayName)) {
		return translate('auth.validation.passwordEchoesIdentity')
	}

	return null
}

export function validateCode(raw: string): string | null {
	const value = raw.trim()

	if (!value) {
		return translate('auth.validation.codeRequired')
	}

	return value.length === CODE_LENGTH
		? null
		: translate('auth.validation.codeIncomplete', { length: CODE_LENGTH })
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
	if (!confirmation) {
		return translate('auth.validation.confirmationRequired')
	}

	return password === confirmation ? null : translate('auth.validation.confirmationMismatch')
}
