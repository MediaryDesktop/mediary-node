import { createQuery } from '@farfetched/core'
import { sample } from 'effector'

import { $nodeReady } from './bridge'
import { createNodeRequestFx } from './client'
import type { NodeSchemas } from './schema'

export type NodeHealth = NodeSchemas['HealthOutputBody']

const fetchNodeHealthFx = createNodeRequestFx<void, NodeHealth>({ url: '/v1/health' })

export const nodeHealthQuery = createQuery({
	effect: fetchNodeHealthFx,
	name: 'nodeHealth'
})

sample({
	clock: $nodeReady.updates,
	filter: (ready: boolean) => ready,
	target: nodeHealthQuery.start
})
