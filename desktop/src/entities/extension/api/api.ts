import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type Extension = NodeSchemas['Extension']
export type ExtensionSetting = NodeSchemas['ExtensionSetting']
export type ExtensionPreview = NodeSchemas['ExtensionPreview']
export type ExtensionUpdate = NodeSchemas['ExtensionUpdate']
export type ExtensionCatalog = NodeSchemas['ExtensionCatalog']
export type CatalogPlugin = NodeSchemas['CatalogPlugin']
export type ExtensionRepository = NodeSchemas['ExtensionRepository']

export interface InstallExtensionParams {
	url: string
	consent: string
}

export interface ConfigureExtensionParams {
	id: string
	enabled?: boolean
	config?: Record<string, string>
}

export interface UpdateExtensionParams {
	id: string
	consent: string
}

export const fetchExtensionsFx = createNodeRequestFx<void, NodeSchemas['ExtensionsOutputBody']>(() => ({
	url: '/v1/extensions'
}))

export const previewExtensionFx = createNodeRequestFx<string, ExtensionPreview>(url => ({
	url: '/v1/extensions/preview',
	method: 'POST',
	body: { url },
	timeout: 30_000
}))

export const installExtensionFx = createNodeRequestFx<InstallExtensionParams, Extension>(body => ({
	url: '/v1/extensions',
	method: 'POST',
	body,
	timeout: 60_000
}))

export const configureExtensionFx = createNodeRequestFx<ConfigureExtensionParams, Extension>(
	({ id, ...body }) => ({
		url: `/v1/extensions/${id}`,
		method: 'PATCH',
		body
	})
)

export const removeExtensionFx = createNodeRequestFx<string, void>(id => ({
	url: `/v1/extensions/${id}`,
	method: 'DELETE'
}))

export const checkExtensionUpdatesFx = createNodeRequestFx<void, NodeSchemas['ExtensionsOutputBody']>(() => ({
	url: '/v1/extensions/updates',
	method: 'POST',
	timeout: 60_000
}))

export const updateExtensionFx = createNodeRequestFx<UpdateExtensionParams, Extension>(({ id, consent }) => ({
	url: `/v1/extensions/${id}/update`,
	method: 'POST',
	body: { consent },
	timeout: 60_000
}))

export const fetchExtensionCatalogFx = createNodeRequestFx<boolean, ExtensionCatalog>(refresh => ({
	url: '/v1/extensions/catalog',
	query: { refresh },
	timeout: 60_000
}))

export const addExtensionRepositoryFx = createNodeRequestFx<string, ExtensionRepository>(url => ({
	url: '/v1/extensions/repositories',
	method: 'POST',
	body: { url },
	timeout: 30_000
}))

export const removeExtensionRepositoryFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/extensions/repositories/${id}`,
	method: 'DELETE'
}))
