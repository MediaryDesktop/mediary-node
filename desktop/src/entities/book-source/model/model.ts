import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { sample } from 'effector'

import { nodeTopic } from '@infra/node'

import {
	cancelBookDownloadFx,
	checkBookOPDSServerFx,
	createBookOPDSServerFx,
	deleteBookOPDSServerFx,
	enqueueBookDownloadFx,
	fetchBookDownloadSettingsFx,
	fetchBookDownloadsFx,
	fetchBookEditionsFx,
	fetchBookOPDSServersFx,
	fetchBookSourcesFx,
	fetchGutenbergSettingsFx,
	forgetBookDownloadFx,
	putBookDownloadSettingsFx,
	putGutenbergSettingsFx,
	refreshGutenbergCatalogFx,
	retryBookDownloadFx,
	updateBookOPDSServerFx
} from '../api/api'

export const bookSourcesQuery = createQuery({ effect: fetchBookSourcesFx, name: 'bookSources' })

export const bookEditionsQuery = createQuery({ effect: fetchBookEditionsFx, name: 'bookEditions' })

// A page opened while the last book's search is still out must show its own.
concurrency(bookEditionsQuery, { strategy: 'TAKE_LATEST' })

export const gutenbergSettingsQuery = createQuery({
	effect: fetchGutenbergSettingsFx,
	name: 'gutenbergSettings'
})

export const putGutenbergSettingsMutation = createMutation({
	effect: putGutenbergSettingsFx,
	name: 'putGutenbergSettings'
})

export const refreshGutenbergCatalogMutation = createMutation({
	effect: refreshGutenbergCatalogFx,
	name: 'refreshGutenbergCatalog'
})

export const bookOPDSServersQuery = createQuery({ effect: fetchBookOPDSServersFx, name: 'bookOPDSServers' })

export const createBookOPDSServerMutation = createMutation({
	effect: createBookOPDSServerFx,
	name: 'createBookOPDSServer'
})

export const updateBookOPDSServerMutation = createMutation({
	effect: updateBookOPDSServerFx,
	name: 'updateBookOPDSServer'
})

export const deleteBookOPDSServerMutation = createMutation({
	effect: deleteBookOPDSServerFx,
	name: 'deleteBookOPDSServer'
})

export const checkBookOPDSServerMutation = createMutation({
	effect: checkBookOPDSServerFx,
	name: 'checkBookOPDSServer'
})

// The catalogue's download and weekly check are reported as they go.
const catalogChanged = nodeTopic('books.catalog')

keepFresh(gutenbergSettingsQuery, {
	triggers: [
		catalogChanged,
		putGutenbergSettingsMutation.finished.success,
		refreshGutenbergCatalogMutation.finished.success
	]
})

const serversChanged = [
	createBookOPDSServerMutation.finished.success,
	updateBookOPDSServerMutation.finished.success,
	deleteBookOPDSServerMutation.finished.success
]

keepFresh(bookOPDSServersQuery, { triggers: serversChanged })

// A source turned on or off, or a catalogue that has just arrived, changes what
// a book page finds.
const sourcesChanged = [...serversChanged, putGutenbergSettingsMutation.finished.success, catalogChanged]

keepFresh(bookSourcesQuery, { triggers: sourcesChanged })
keepFresh(bookEditionsQuery, { triggers: sourcesChanged })

export const bookDownloadsQuery = createQuery({ effect: fetchBookDownloadsFx, name: 'bookDownloads' })

export const bookDownloadSettingsQuery = createQuery({
	effect: fetchBookDownloadSettingsFx,
	name: 'bookDownloadSettings'
})

export const enqueueBookDownloadMutation = createMutation({
	effect: enqueueBookDownloadFx,
	name: 'enqueueBookDownload'
})

export const cancelBookDownloadMutation = createMutation({
	effect: cancelBookDownloadFx,
	name: 'cancelBookDownload'
})

export const retryBookDownloadMutation = createMutation({
	effect: retryBookDownloadFx,
	name: 'retryBookDownload'
})

export const forgetBookDownloadMutation = createMutation({
	effect: forgetBookDownloadFx,
	name: 'forgetBookDownload'
})

export const putBookDownloadSettingsMutation = createMutation({
	effect: putBookDownloadSettingsFx,
	name: 'putBookDownloadSettings'
})

// The node reports every change in the queue, and the list asks again on each
// one rather than polling; only the answer to the last of them may stand.
concurrency(bookDownloadsQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: [
		nodeTopic('books.download'),
		enqueueBookDownloadMutation.finished.success,
		forgetBookDownloadMutation.finished.success
	],
	target: bookDownloadsQuery.start
})

keepFresh(bookDownloadSettingsQuery, { triggers: [putBookDownloadSettingsMutation.finished.success] })
