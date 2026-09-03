import { createEffect } from 'effector'
import type { Effect } from 'effector'
import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

import { HttpRequestError } from './api-error'
import { unauthorized } from './unauthorized'

export type RequestConfig = FetchOptions & {
	url: string

	expectsUnauthorized?: boolean
}

type ConfigOf<Params> = RequestConfig | ((params: Params) => RequestConfig)

type Provider<T> = T | (() => T)

export interface RequestFxOptions {
	baseURL: Provider<string>

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

function isIdempotent(method?: string): boolean {
	const normalized = (method ?? 'GET').toUpperCase()

	return normalized === 'GET' || normalized === 'HEAD'
}

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
