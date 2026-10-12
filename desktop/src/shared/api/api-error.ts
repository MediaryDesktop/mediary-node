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

export interface ApiProblem {
	field: string
	message: string
	fromSchema: boolean
}

const SCHEMA_PREFIX = 'body.'

function fieldOf(location: string): string | null {
	const name = location.startsWith(SCHEMA_PREFIX) ? location.slice(SCHEMA_PREFIX.length) : location

	return name === '' || name.includes('.') || name.includes('[') ? null : name
}

export function getApiProblems(error: unknown): ApiProblem[] {
	const problem = error instanceof HttpRequestError ? error.body : undefined
	const seen = new Set<string>()
	const problems: ApiProblem[] = []

	for (const detail of problem?.errors ?? []) {
		const location = detail?.location

		if (!location || !detail?.message) {
			continue
		}

		const field = fieldOf(location)

		if (!field || seen.has(field)) {
			continue
		}

		seen.add(field)

		problems.push({
			field,
			message: detail.message,
			fromSchema: location.startsWith(SCHEMA_PREFIX)
		})
	}

	return problems
}

// What a failed request hands its watchers: farfetched's failure payload, narrowed
// to the part that carries the server's explanation.
export interface RequestFailure {
	error: { body?: { detail?: string } | null }
}

// The server's own explanation of a failed request, or the caller's text when it
// gave none (or never answered).
export function problemDetail(error: RequestFailure['error'], fallback: string): string {
	return error.body?.detail ?? fallback
}
