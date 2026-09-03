import type { components, operations } from './schema.gen'

export type CloudSchemas = NonNullable<components['schemas']>

export type CloudOperation<Id extends keyof operations> = operations[Id]

export type CloudResponse<Id extends keyof operations> = operations[Id]['responses'] extends {
	200: { content: { 'application/json': infer Body } }
}
	? Body
	: never
