import { createQuery } from '@farfetched/core'
import { createEffect, sample } from 'effector'

import { $nodeReady } from './bridge'
import { nodeFetch } from './client'
import type { NodeSchemas } from './schema'

/**
 * The reference shape for every query here: the response type is generated
 * from the OpenAPI document, the invalidation rule lives next to the query it
 * governs (docs/architecture.md §4), and it refuses to run before node-ready.
 */

export type NodeHealth = NodeSchemas['HealthOutputBody']

const fetchNodeHealthFx = createEffect<void, NodeHealth>(() => nodeFetch<NodeHealth>('/v1/health'))

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
