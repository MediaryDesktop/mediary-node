import { useCallback, useState } from 'react'

import { checkState, fileIdsUnder } from './build-tree'
import type { TreeNode } from './build-tree'

// Ticked files, by id. Ticking a folder ticks every file under it.
export function useTreeSelection() {
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())

	const check = useCallback((node: TreeNode, checked: boolean) => {
		setSelected(current => {
			const next = new Set(current)
			const ids = node.kind === 'file' ? [node.file.id] : fileIdsUnder(node)

			for (const id of ids) {
				if (checked) {
					next.add(id)
				} else {
					next.delete(id)
				}
			}

			return next
		})
	}, [])

	const clear = useCallback(() => setSelected(new Set()), [])

	const stateOf = (node: TreeNode) => checkState(node, selected)

	return { selected, check, clear, stateOf }
}
