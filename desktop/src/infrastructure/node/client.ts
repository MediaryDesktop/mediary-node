import { createRequestFx } from '@shared/api'

import { requireNodeConnection } from './bridge'

/**
 * The connection to the local node process.
 *
 * Both providers are functions rather than values: the address and the token
 * are handed over by the Electron main process after the window already exists,
 * so there is nothing to bind at module load. The token rides on every request
 * because loopback is not access control — any process on the machine can
 * reach 127.0.0.1 too.
 */
export const createNodeRequestFx = createRequestFx({
	baseURL: () => requireNodeConnection().baseUrl,
	headers: () => ({ 'X-Mediary-Node-Token': requireNodeConnection().token }),
	// The node is a process on this machine: a request that takes seconds means
	// it is wedged, not that the network is slow.
	timeout: 5_000
})

/** Opens the node's event stream. Used by whoever shows live progress. */
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
