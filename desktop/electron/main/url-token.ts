import { createHmac } from 'node:crypto'

// What the node derives its URL token under; the node does the same in
// server/internal/httpapi/middleware/auth.go. Change both together.
const URL_TOKEN_LABEL = 'mediary-node url token v1'

/**
 * The token that may ride in an address — a WebSocket, a video, a page image,
 * a poster. It opens only the node's read-only media routes, so the node token
 * itself never has to be in a URL, where process lists, caches and logs keep it.
 */
export function urlToken(nodeToken: string): string {
	if (!nodeToken) {
		return ''
	}

	return createHmac('sha256', nodeToken).update(URL_TOKEN_LABEL).digest('base64url')
}
