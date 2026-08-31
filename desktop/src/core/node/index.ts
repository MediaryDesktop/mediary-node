/**
 * The connection to the local node process.
 *
 * This is infrastructure, not domain: it owns *how* to reach the node — the
 * address and token handed over by the Electron main process, the supervisor's
 * state, the HTTP client and the event stream. It owns nothing *about* media.
 *
 * Library roots, download directories and playback preferences are node
 * settings, but they are domain data with real owners: they belong to
 * `modules/library`, `modules/downloads` and `modules/playback`. Putting them
 * here because "they are about the node" is how core turns into the next
 * shared/.
 *
 * The public surface is deliberately small. Anything not exported here is an
 * implementation detail — see docs/architecture.md §3.
 */

export {
	$nodeConnection,
	$nodeReady,
	$nodeState,
	nodeBridgeMounted,
	nodeStateChanged,
	subscribeToNodeState
} from './bridge'

export { nodeFetch, openNodeEventStream } from './client'

export { nodeHealthQuery, type NodeHealth } from './health.query'

export type { NodeConnection, NodeState } from './bridge-types'

export type { NodeSchemas, NodeOperation, NodeResponse } from './schema'
