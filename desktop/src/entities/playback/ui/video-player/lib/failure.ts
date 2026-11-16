// Why the stream stopped, in the shape the app's problem readers take
// (problemCode, problemDetail): the node's RFC 7807 body, if it sent one. The
// body's `type` is what says which failure it is — a missing FFmpeg, say — and
// is kept for that; `message` is its sentence, for the screen.
export interface PlayerFailure {
	status?: number
	message?: string
	body?: { type?: string; detail?: string } | null
}

interface FailedResponse {
	status?: number
	responseText?: unknown
}

export function playerFailure({ status, responseText }: FailedResponse): PlayerFailure {
	if (typeof responseText !== 'string') {
		return { status }
	}

	try {
		const parsed = JSON.parse(responseText) as { type?: unknown; detail?: unknown }
		const type = typeof parsed.type === 'string' ? parsed.type : undefined
		const detail = typeof parsed.detail === 'string' ? parsed.detail : undefined

		return { status, message: detail, body: { type, detail } }
	} catch {
		return { status }
	}
}
