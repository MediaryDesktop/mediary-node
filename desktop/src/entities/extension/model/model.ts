import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { sample } from 'effector'

import { nodeStreamResumed, nodeTopic } from '@infra/node'

import {
	addExtensionRepositoryFx,
	checkExtensionUpdatesFx,
	configureExtensionFx,
	fetchExtensionCatalogFx,
	fetchExtensionsFx,
	installExtensionFx,
	previewExtensionFx,
	removeExtensionFx,
	removeExtensionRepositoryFx,
	updateExtensionFx
} from '../api/api'

export const extensionsQuery = createQuery({ effect: fetchExtensionsFx, name: 'extensions' })

export const extensionCatalogQuery = createQuery({
	effect: fetchExtensionCatalogFx,
	name: 'extensionCatalog'
})

export const previewExtensionMutation = createMutation({
	effect: previewExtensionFx,
	name: 'previewExtension'
})
export const installExtensionMutation = createMutation({
	effect: installExtensionFx,
	name: 'installExtension'
})
export const configureExtensionMutation = createMutation({
	effect: configureExtensionFx,
	name: 'configureExtension'
})
export const removeExtensionMutation = createMutation({ effect: removeExtensionFx, name: 'removeExtension' })
export const checkExtensionUpdatesMutation = createMutation({
	effect: checkExtensionUpdatesFx,
	name: 'checkExtensionUpdates'
})
export const updateExtensionMutation = createMutation({ effect: updateExtensionFx, name: 'updateExtension' })
export const addExtensionRepositoryMutation = createMutation({
	effect: addExtensionRepositoryFx,
	name: 'addExtensionRepository'
})
export const removeExtensionRepositoryMutation = createMutation({
	effect: removeExtensionRepositoryFx,
	name: 'removeExtensionRepository'
})

concurrency(extensionsQuery, { strategy: 'TAKE_LATEST' })
concurrency(extensionCatalogQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: [nodeTopic('extension'), nodeStreamResumed, checkExtensionUpdatesMutation.finished.success],
	target: extensionsQuery.start
})

sample({
	clock: [nodeTopic('extension'), nodeStreamResumed],
	fn: () => false,
	target: extensionCatalogQuery.start
})
