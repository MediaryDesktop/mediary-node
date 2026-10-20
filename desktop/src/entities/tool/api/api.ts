import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type Tool = NodeSchemas['Tool']
export type ToolId = Tool['id']
export type ToolState = Tool['state']
export type ToolProgress = NodeSchemas['ToolProgress']

export const fetchToolsFx = createNodeRequestFx<void, NodeSchemas['ToolsOutputBody']>(() => ({
	url: '/v1/tools'
}))

export const installToolFx = createNodeRequestFx<ToolId, Tool>(id => ({
	url: `/v1/tools/${id}/install`,
	method: 'POST'
}))

export const cancelToolInstallFx = createNodeRequestFx<ToolId, Tool>(id => ({
	url: `/v1/tools/${id}/install`,
	method: 'DELETE'
}))

export const removeToolFx = createNodeRequestFx<ToolId, Tool>(id => ({
	url: `/v1/tools/${id}`,
	method: 'DELETE'
}))
