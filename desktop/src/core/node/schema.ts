import type { components, operations } from './schema.gen'

/**
 * Named shortcuts into the generated node contract.
 *
 * `node.gen.ts` is produced by `npm run api:types:node` from
 * ../server/api/openapi.yaml and must never be edited. These aliases exist so
 * call sites say `NodeSchemas['HealthOutputBody']` instead of reaching four
 * levels into the generator's output.
 */

export type NodeSchemas = NonNullable<components['schemas']>

export type NodeOperation<Id extends keyof operations> = operations[Id]

export type NodeResponse<Id extends keyof operations> = operations[Id]['responses'] extends {
	200: { content: { 'application/json': infer Body } }
}
	? Body
	: never
