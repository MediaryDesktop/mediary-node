/**
 * How the renderer talks HTTP — the mechanics only.
 *
 * Which servers exist, where they are and what credential each one takes is
 * `infrastructure/`; what the endpoints mean is the entity that owns them.
 */

export { createRequestFx } from './create-request-fx'
export type { RequestConfig, RequestFxOptions } from './create-request-fx'

export { HttpRequestError, getApiErrorMessage, getApiErrorStatus, getApiFieldErrors } from './api-error'
export type { FieldErrors, ProblemBody, ProblemDetail } from './api-error'

export { unauthorized } from './unauthorized'
