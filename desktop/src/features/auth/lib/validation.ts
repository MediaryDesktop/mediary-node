/**
 * Client-side copies of the rules in the cloud's `internal/common/pipes`.
 *
 * A copy, not a second authority: the server validates every field again and
 * its answer wins. This exists so that a typo is caught before a round trip,
 * and the limits are kept identical on purpose — a client that accepts a
 * 9-character password only to have the server reject it teaches the user that
 * the form lies.
 */
import { translate } from '@shared/i18n'

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128
export const MIN_DISPLAY_NAME = 2
export const MAX_DISPLAY_NAME = 40
export const MAX_EMAIL_LENGTH = 254
export const CODE_LENGTH = 6

/**
 * How long a mailed code stays usable — `AUTH_CODE_TTL` in the cloud's config,
 * thirty minutes by default. The countdown a form shows is a copy of that
 * deadline, not the deadline itself: the server decides, and a deployment that
 * shortened it would expire a code this counter still believes in.
 */
export const CODE_TTL_SECONDS = 30 * 60

/** Collapses runs of whitespace, matching the server's `strings.Fields` join. */
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

	// Deliberately loose: the server parses the address properly, and a strict
	// regex here would reject valid addresses the server accepts.
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

	// Counts code points, not UTF-16 units, so an emoji costs one character
	// here and one on the server.
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
