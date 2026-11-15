import type { EventCallable, Store } from 'effector'
import { useUnit } from 'effector-react'

import { queryPhase } from '@shared/lib'
import type { QueryPhase } from '@shared/lib'

import { whenNodeReady } from './node-data'
import { useNodeData } from './useNodeData'
import type { NodeDataOptions } from './useNodeData'

export interface NodeQueryUnits<Params, Data> {
	start: EventCallable<Params>
	$data: Store<Data | null>
	$failed: Store<boolean>
	$error: Store<unknown>
}

export interface NodeQueryOptions<Params, Data> extends NodeDataOptions<Params> {
	isEmpty?: (data: Data) => boolean
}

export interface NodeQueryState<Data> {
	phase: QueryPhase
	data: Data | null
	error: unknown
	retry: () => void
}

// useNodeData with the convention every screen shows its query by: loading,
// failed with a way to ask again, empty, or the data (queryPhase).
export function useNodeQuery<Params, Data>(
	query: NodeQueryUnits<Params, Data>,
	{ isEmpty, ...options }: NodeQueryOptions<NoInfer<Params>, NoInfer<Data>> = {}
): NodeQueryState<Data> {
	useNodeData(query, options)

	const [data, failed, error, ask] = useUnit([
		query.$data,
		query.$failed,
		query.$error,
		whenNodeReady(query)
	])

	return {
		phase: queryPhase({ data, failed, isEmpty }),
		data,
		error,
		retry: () => ask(options.params as Params)
	}
}
