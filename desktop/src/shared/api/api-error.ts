import { FetchError } from 'ofetch'

export interface ProblemDetail {
	message?: string

	location?: string
	value?: unknown
}

export interface ProblemBody {
	type?: string
	title?: string
	status?: number
	detail?: string
	errors?: ProblemDetail[]
}

export type FieldErrors = Record<string, string>

export class HttpRequestError extends Error {
	readonly status: number
	readonly body?: ProblemBody

	constructor(message: string, options: { status: number; body?: ProblemBody; cause?: unknown }) {
		super(message, { cause: options.cause })
		this.name = 'HttpRequestError'
		this.status = options.status
		this.body = options.body
	}

	get isOffline(): boolean {
		return this.status === 0
	}

	static fromUnknown(error: unknown, fallbackMessage = 'Request failed'): HttpRequestError {
		if (error instanceof HttpRequestError) {
			return error
		}

		if (error instanceof FetchError) {
			const status = error.response?.status ?? error.status ?? error.statusCode ?? 0
			const body = error.data as ProblemBody | undefined

			const message = body?.detail || (status === 0 ? 'Server unreachable' : fallbackMessage)

			return new HttpRequestError(message, { status, body, cause: error })
		}

		if (error instanceof Error) {
			return new HttpRequestError(error.message || fallbackMessage, { status: 0, cause: error })
		}

		return new HttpRequestError(fallbackMessage, { status: 0, cause: error })
	}
}

function fieldOf(location: string | undefined): string | null {
	if (!location) {
		return null
	}

	const name = location.replace(/^body\./u, '')

	return name.includes('.') || name.includes('[') ? null : name
}

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

export function getApiErrorStatus(error: unknown): number | undefined {
	if (error instanceof HttpRequestError) {
		return error.status || undefined
	}

	if (error instanceof FetchError) {
		return error.response?.status ?? error.status ?? error.statusCode
	}

	return undefined
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof HttpRequestError || error instanceof FetchError) {
		return HttpRequestError.fromUnknown(error, fallback).message || fallback
	}

	return fallback
}
