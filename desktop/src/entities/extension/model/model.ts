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

// The parameter is whether to read every repository again; the node reuses a
// read for an hour otherwise.
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

// The node keeps what the last check for updates found, so the list asked
// again carries the update marks.
sample({
	clock: [nodeTopic('extension'), nodeStreamResumed, checkExtensionUpdatesMutation.finished.success],
	target: extensionsQuery.start
})

// Installs and removals change the catalog's "installed" marks; repositories
// change the catalog itself. A read under an hour old is reused by the node.
sample({
	clock: [nodeTopic('extension'), nodeStreamResumed],
	fn: () => false,
	target: extensionCatalogQuery.start
})
