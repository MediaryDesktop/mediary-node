import { FetchError } from 'ofetch'

/**
 * One normalized failure shape for every HTTP call in the renderer.
 *
 * Both backends are huma services, so both answer with RFC 7807
 * `application/problem+json`: a human sentence in `detail`, and — when the
 * failure is attributable to inputs — one entry per offending field in
 * `errors`. That is a transport fact about the two servers this client talks
 * to, not domain knowledge, which is why the shape is described here and not
 * imported from either generated contract.
 */

/** One field-level complaint inside a problem document. */
export interface ProblemDetail {
	message?: string
	/** The input it is about: `email`, or a JSON pointer like `body.email`. */
	location?: string
	value?: unknown
}

/** RFC 7807 problem document, as huma emits it. */
export interface ProblemBody {
	type?: string
	title?: string
	status?: number
	detail?: string
	errors?: ProblemDetail[]
}

/** Field name → message, for errors the server attributed to one input. */
export type FieldErrors = Record<string, string>

/** Normalized HTTP failure thrown by `createRequestFx` after ofetch rejects. */
export class HttpRequestError extends Error {
	/** 0 when the request never reached a server (offline, DNS, timeout). */
	readonly status: number
	readonly body?: ProblemBody

	constructor(message: string, options: { status: number; body?: ProblemBody; cause?: unknown }) {
		super(message, { cause: options.cause })
		this.name = 'HttpRequestError'
		this.status = options.status
		this.body = options.body
	}

	/** True when nothing answered — a different failure from "answered 4xx". */
	get isOffline(): boolean {
		return this.status === 0
	}

	/**
	 * Coerce any caught value into `HttpRequestError`; idempotent when already
	 * normalized.
	 *
	 * The fallbacks are English and developer-facing on purpose: this layer has
	 * no language, and a sentence a user should read is composed where the
	 * failure is rendered — see `features/auth/lib/failure.ts`.
	 */
	static fromUnknown(error: unknown, fallbackMessage = 'Request failed'): HttpRequestError {
		if (error instanceof HttpRequestError) {
			return error
		}

		if (error instanceof FetchError) {
			const status = error.response?.status ?? error.status ?? error.statusCode ?? 0
			const body = error.data as ProblemBody | undefined

			// `detail` carries the human-readable sentence; `title` is the status
			// name ("Unprocessable Entity"), which tells a user nothing.
			const message = body?.detail || (status === 0 ? 'Server unreachable' : fallbackMessage)

			return new HttpRequestError(message, { status, body, cause: error })
		}

		if (error instanceof Error) {
			return new HttpRequestError(error.message || fallbackMessage, { status: 0, cause: error })
		}

		return new HttpRequestError(fallbackMessage, { status: 0, cause: error })
	}
}

/**
 * huma reports a field either as the bare name our `apperr.Invalid` sets
 * (`email`) or, for schema-level failures it catches before the handler runs,
 * as a JSON pointer into the request (`body.email`). Both name the same input.
 */
function fieldOf(location: string | undefined): string | null {
	if (!location) {
		return null
	}

	const name = location.replace(/^body\./u, '')

	return name.includes('.') || name.includes('[') ? null : name
}

/** The per-field complaints in a failure, keyed by input name. */
export function getApiFieldErrors(error: unknown): FieldErrors {
	const problem = error instanceof HttpRequestError ? error.body : undefined
	const fields: FieldErrors = {}

	for (const detail of problem?.errors ?? []) {
		const field = fieldOf(detail?.location)

		if (field && detail?.message && !fields[field]) {
			fields[field] = detail.message
		}
	}

	return fields
}

/** HTTP status from a normalized, ofetch, or loosely shaped error. */
export function getApiErrorStatus(error: unknown): number | undefined {
	if (error instanceof HttpRequestError) {
		return error.status || undefined
	}

	if (error instanceof FetchError) {
		return error.response?.status ?? error.status ?? error.statusCode
	}

	return undefined
}

/** A user-facing sentence for any caught value. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof HttpRequestError || error instanceof FetchError) {
		return HttpRequestError.fromUnknown(error, fallback).message || fallback
	}

	return fallback
}
