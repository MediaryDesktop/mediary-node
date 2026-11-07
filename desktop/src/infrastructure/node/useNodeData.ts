import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { whenNodeReady } from './node-data'
import type { AnyNodeAsk } from './node-data'

export interface NodeDataOptions<Params> {
	params?: Params
	enabled?: boolean
}

// A screen says which node data it needs; when to actually ask is whenNodeReady's
// rule, not the screen's. It asks again when the parameters change — compared by
// value, since they are often an object built fresh on every render.
export function useNodeData<Params>(
	target: AnyNodeAsk<Params>,
	{ params, enabled = true }: NodeDataOptions<NoInfer<Params>> = {}
): void {
	const ask = useUnit(whenNodeReady(target))
	const key = JSON.stringify(params ?? null)

	useEffect(() => {
		if (enabled) {
			ask(params as Params)
		}
		// `key` stands for `params`: the same value under a new identity is not a new question.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ask, enabled, key])
}
