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
	forgetBookDownloadFx,
	putBookDownloadSettingsFx,
	retryBookDownloadFx,
	updateBookOPDSServerFx
} from '../api/api'

export const bookSourcesQuery = createQuery({ effect: fetchBookSourcesFx, name: 'bookSources' })

export const bookEditionsQuery = createQuery({ effect: fetchBookEditionsFx, name: 'bookEditions' })

concurrency(bookEditionsQuery, { strategy: 'TAKE_LATEST' })

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

const serversChanged = [
	createBookOPDSServerMutation.finished.success,
	updateBookOPDSServerMutation.finished.success,
	deleteBookOPDSServerMutation.finished.success
]

keepFresh(bookOPDSServersQuery, { triggers: serversChanged })

keepFresh(bookSourcesQuery, { triggers: serversChanged })
keepFresh(bookEditionsQuery, { triggers: serversChanged })

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
