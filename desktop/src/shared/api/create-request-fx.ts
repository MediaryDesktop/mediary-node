import { createEffect } from 'effector'
import type { Effect } from 'effector'
import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

import { HttpRequestError } from './api-error'
import { unauthorized } from './unauthorized'

/**
 * The request factory both backends are reached through.
 *
 * Carried over from the previous client, where it earned its place: one funnel
 * for headers, timeouts, retry policy and error normalization means a call site
 * declares *what* it wants and nothing about how requests behave. The desktop
 * adaptations are three:
 *
 *  - no `credentials: 'include'` — this is not a browser and there is no cookie
 *    jar; credentials are headers, supplied per connection;
 *  - `baseURL` and `headers` may be functions, because the node's address and
 *    token are only known once the Electron main process reports them;
 *  - a 401 fires an event instead of navigating (see ./unauthorized.ts).
 */

/** A request described declaratively: `url` plus anything ofetch understands. */
export type RequestConfig = FetchOptions & {
	url: string
	/**
	 * Set on calls where 401 is an answer rather than an expired session — the
	 * sign-in request itself, above all. Without it, a mistyped password would
	 * report the *current* session as dead.
	 */
	expectsUnauthorized?: boolean
}

/** Either a fixed config or one derived from the effect's parameters. */
type ConfigOf<Params> = RequestConfig | ((params: Params) => RequestConfig)

/** A value or a function producing it at request time. */
type Provider<T> = T | (() => T)

export interface RequestFxOptions {
	baseURL: Provider<string>
	/** Credentials and anything else every request on this connection carries. */
	headers?: Provider<HeadersInit>
	timeout?: number
}

const DEFAULT_TIMEOUT_MS = 10_000
const IDEMPOTENT_RETRY_COUNT = 1
const IDEMPOTENT_RETRY_STATUS_CODES = [502, 503, 504]

function resolve<T>(provider: Provider<T>): T {
	return typeof provider === 'function' ? (provider as () => T)() : provider
}

function configOf<Params>(config: ConfigOf<Params>, params: Params): RequestConfig {
	return typeof config === 'function' ? config(params) : config
}

/**
 * Retries are for requests that can be repeated without changing anything.
 * A retried POST is a second registration, a second payment, a second session.
 */
function isIdempotent(method?: string): boolean {
	const normalized = (method ?? 'GET').toUpperCase()

	return normalized === 'GET' || normalized === 'HEAD'
}

/**
 * Binds one connection — a base URL and its credentials — and returns the
 * factory that turns a request description into an Effector effect.
 */
export function createRequestFx(options: RequestFxOptions) {
	return <Params = void, Result = void>(
		config: ConfigOf<Params>
	): Effect<Params, Result, HttpRequestError> =>
		createEffect<Params, Result, HttpRequestError>((params: Params) => {
			const {
				url,
				headers: perRequestHeaders,
				method,
				timeout,
				retry,
				retryStatusCodes,
				expectsUnauthorized,
				...rest
			} = configOf(config, params)

			const headers = new Headers(resolve(options.headers ?? {}))

			if (perRequestHeaders) {
				new Headers(perRequestHeaders).forEach((value, key) => headers.set(key, value))
			}

			const idempotent = isIdempotent(method)

			return ofetch<Result>(url, {
				...rest,
				method,
				headers,
				baseURL: resolve(options.baseURL),
				responseType: 'json',
				timeout: timeout ?? options.timeout ?? DEFAULT_TIMEOUT_MS,
				retry: retry ?? (idempotent ? IDEMPOTENT_RETRY_COUNT : false),
				retryStatusCodes:
					retryStatusCodes ?? (idempotent ? IDEMPOTENT_RETRY_STATUS_CODES : undefined),
				onResponseError({ response }) {
					if (response.status === 401 && !expectsUnauthorized) {
						unauthorized({ url })
					}
				}
			}).catch((error: unknown) => {
				throw HttpRequestError.fromUnknown(error)
			})
		})
}
