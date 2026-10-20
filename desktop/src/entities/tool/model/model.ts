import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { sample } from 'effector'

import { nodeStreamResumed, nodeTopic } from '@infra/node'

import { cancelToolInstallFx, fetchToolsFx, installToolFx, removeToolFx } from '../api/api'

export const toolsQuery = createQuery({ effect: fetchToolsFx, name: 'tools' })

export const installToolMutation = createMutation({ effect: installToolFx, name: 'installTool' })
export const cancelToolInstallMutation = createMutation({
	effect: cancelToolInstallFx,
	name: 'cancelToolInstall'
})
export const removeToolMutation = createMutation({ effect: removeToolFx, name: 'removeTool' })

// The node announces an install twice a second while it downloads; only the
// answer to the latest question may stand.
concurrency(toolsQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: [
		nodeTopic('tools'),
		nodeStreamResumed,
		installToolMutation.finished.finally,
		cancelToolInstallMutation.finished.finally,
		removeToolMutation.finished.finally
	],
	target: toolsQuery.start
})
