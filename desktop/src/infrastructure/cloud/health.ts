import { createCloudRequestFx } from './client'
import type { CloudSchemas } from './schema'

export type CloudHealth = CloudSchemas['HealthOutputBody']

// The cloud's own state, including the oldest client it still serves.
export const fetchCloudHealthFx = createCloudRequestFx<void, CloudHealth>({ url: '/v1/health' })
