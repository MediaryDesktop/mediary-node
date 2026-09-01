import { getApiFieldErrors, HttpRequestError } from '@shared/api'
import type { FieldErrors } from '@shared/api'
import { translate } from '@shared/i18n'

/** A failed submit reduced to what a form can render. */
export interface AuthFailure {
	/** The banner above the form; empty when a field already says it. */
	message: string
	fields: FieldErrors
}

/** Client-side complaints, keyed the way the server keys its own. */
export function localFailure(fields: FieldErrors): AuthFailure {
	return { message: '', fields }
}

export function toAuthFailure(error: unknown): AuthFailure {
	const fields = getApiFieldErrors(error)
	const failure = HttpRequestError.fromUnknown(error)

	// The server writes its own sentences and they are shown as they came: text
	// we did not author cannot be translated here. Only our own fallbacks —
	// which is all the user sees when the cloud never answered — are localised.
	const message = failure.isOffline
		? translate('auth.error.cloudUnreachable')
		: (failure.body?.detail ?? translate('auth.error.requestFailed'))

	// A single-field rejection arrives twice — the cloud's error filter puts the
	// same sentence in `detail` and in the one entry of `errors`. Showing both
	// prints it under the input and again in the banner above the form, so the
	// banner keeps only what no field already says.
	const covered = Object.values(fields).includes(message)

	return { message: covered ? '' : message, fields }
}
