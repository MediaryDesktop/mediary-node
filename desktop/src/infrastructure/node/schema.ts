import type { components, operations } from './schema.gen'

export type NodeSchemas = NonNullable<components['schemas']>

export type NodeOperation<Id extends keyof operations> = operations[Id]

export type NodeResponse<Id extends keyof operations> = operations[Id]['responses'] extends {
	200: { content: { 'application/json': infer Body } }
}
	? Body
	: never
