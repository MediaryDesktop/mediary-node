import { ofetch } from 'ofetch'

import { requireNodeConnection } from './bridge'

/** HTTP client for the local node — the token header is on every request,
 * since any process on the machine can reach loopback too. */
export const nodeFetch = ofetch.create({
	retry: 1,
	retryDelay: 300,
	onRequest({ options }) {
		const connection = requireNodeConnection()

		options.baseURL = connection.baseUrl
		options.headers.set('X-Mediary-Node-Token', connection.token)
	}
})

/** Opens the node's event stream. Used by modules that show live progress. */
export function openNodeEventStream(topics: string[] = []): WebSocket {
	const connection = requireNodeConnection()

	const url = new URL(connection.wsUrl)
	// The browser WebSocket API can't set headers; the node accepts the token
	// as a query param for /ws only.
	url.searchParams.set('token', connection.token)

	for (const topic of topics) {
		url.searchParams.append('topic', topic)
	}

	return new WebSocket(url)
}
