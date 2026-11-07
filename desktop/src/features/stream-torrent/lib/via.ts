import type { StreamVia } from '../model/model'

// Streaming through a debrid service needs one set up. Without it the node's own
// client is the only way, whatever was chosen while one was.
export function effectiveVia(chosen: StreamVia, hasDebrid: boolean): StreamVia {
	return hasDebrid ? chosen : 'embedded'
}
