import { createRequestFx } from '@shared/api'

import { requireNodeConnection } from './bridge'

export const createNodeRequestFx = createRequestFx({
	baseURL: () => requireNodeConnection().baseUrl,
	headers: () => ({ 'X-Mediary-Node-Token': requireNodeConnection().token }),

	timeout: 5_000
})

export function openNodeEventStream(topics: string[] = []): WebSocket {
	const connection = requireNodeConnection()

	const url = new URL(connection.wsUrl)

	url.searchParams.set('token', connection.token)

	for (const topic of topics) {
		url.searchParams.append('topic', topic)
	}

	return new WebSocket(url)
}

// A video element cannot send headers, so media URLs carry the token the way the
// event stream does. The node accepts it only on its read-only media routes.
export function nodeMediaUrl(path: string): string {
	const connection = requireNodeConnection()

	const url = new URL(path, connection.baseUrl)

	url.searchParams.set('token', connection.token)

	return url.toString()
}
