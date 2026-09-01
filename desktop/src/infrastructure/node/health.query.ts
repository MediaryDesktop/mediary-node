import { createQuery } from '@farfetched/core'
import { sample } from 'effector'

import { $nodeReady } from './bridge'
import { createNodeRequestFx } from './client'
import type { NodeSchemas } from './schema'

/**
 * The reference shape for every query in the app: the response type is
 * generated from the OpenAPI document, the request is declared through the
 * connection's factory, the invalidation rule lives next to the query it
 * governs, and it refuses to run before node-ready.
 */

export type NodeHealth = NodeSchemas['HealthOutputBody']

const fetchNodeHealthFx = createNodeRequestFx<void, NodeHealth>({ url: '/v1/health' })

export const nodeHealthQuery = createQuery({
	effect: fetchNodeHealthFx,
	name: 'nodeHealth'
})

// Refetch on node-ready: a restart may make the shown version/pairing state stale.
sample({
	clock: $nodeReady.updates,
	filter: (ready: boolean) => ready,
	target: nodeHealthQuery.start
})
