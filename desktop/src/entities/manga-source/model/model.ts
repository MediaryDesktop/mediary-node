import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { sample } from 'effector'

import { nodeTopic } from '@infra/node'

import {
	cancelMangaDownloadFx,
	checkOPDSServerFx,
	createOPDSServerFx,
	deleteMangaLinkFx,
	deleteOPDSServerFx,
	enqueueMangaDownloadsFx,
	fetchMangaChaptersFx,
	fetchMangaDownloadSettingsFx,
	fetchMangaDownloadsFx,
	fetchMangaLinksFx,
	fetchMangaSourcesFx,
	fetchOPDSServersFx,
	forgetMangaDownloadFx,
	putMangaDownloadSettingsFx,
	putMangaLinkFx,
	retryMangaDownloadFx,
	searchMangaSourceFx,
	updateOPDSServerFx
} from '../api/api'

export const opdsServersQuery = createQuery({ effect: fetchOPDSServersFx, name: 'opdsServers' })

export const mangaSourcesQuery = createQuery({ effect: fetchMangaSourcesFx, name: 'mangaSources' })

export const mangaLinksQuery = createQuery({ effect: fetchMangaLinksFx, name: 'mangaLinks' })

export const mangaChaptersQuery = createQuery({ effect: fetchMangaChaptersFx, name: 'mangaChapters' })

export const mangaSearchQuery = createQuery({ effect: searchMangaSourceFx, name: 'mangaSearch' })

export const createOPDSServerMutation = createMutation({
	effect: createOPDSServerFx,
	name: 'createOPDSServer'
})

export const updateOPDSServerMutation = createMutation({
	effect: updateOPDSServerFx,
	name: 'updateOPDSServer'
})

export const deleteOPDSServerMutation = createMutation({
	effect: deleteOPDSServerFx,
	name: 'deleteOPDSServer'
})

export const checkOPDSServerMutation = createMutation({ effect: checkOPDSServerFx, name: 'checkOPDSServer' })

export const putMangaLinkMutation = createMutation({ effect: putMangaLinkFx, name: 'putMangaLink' })

export const deleteMangaLinkMutation = createMutation({ effect: deleteMangaLinkFx, name: 'deleteMangaLink' })

const serversChanged = [
	createOPDSServerMutation.finished.success,
	updateOPDSServerMutation.finished.success,
	deleteOPDSServerMutation.finished.success
]

const linksChanged = [putMangaLinkMutation.finished.success, deleteMangaLinkMutation.finished.success]

keepFresh(opdsServersQuery, { triggers: serversChanged })

keepFresh(mangaSourcesQuery, { triggers: serversChanged })

keepFresh(mangaLinksQuery, { triggers: [...serversChanged, ...linksChanged] })

keepFresh(mangaChaptersQuery, { triggers: [...serversChanged, ...linksChanged] })

export const mangaDownloadsQuery = createQuery({ effect: fetchMangaDownloadsFx, name: 'mangaDownloads' })

export const mangaDownloadSettingsQuery = createQuery({
	effect: fetchMangaDownloadSettingsFx,
	name: 'mangaDownloadSettings'
})

export const enqueueMangaDownloadsMutation = createMutation({
	effect: enqueueMangaDownloadsFx,
	name: 'enqueueMangaDownloads'
})

export const cancelMangaDownloadMutation = createMutation({
	effect: cancelMangaDownloadFx,
	name: 'cancelMangaDownload'
})

export const retryMangaDownloadMutation = createMutation({
	effect: retryMangaDownloadFx,
	name: 'retryMangaDownload'
})

export const forgetMangaDownloadMutation = createMutation({
	effect: forgetMangaDownloadFx,
	name: 'forgetMangaDownload'
})

export const putMangaDownloadSettingsMutation = createMutation({
	effect: putMangaDownloadSettingsFx,
	name: 'putMangaDownloadSettings'
})

concurrency(mangaDownloadsQuery, { strategy: 'TAKE_LATEST' })

sample({
	clock: [
		nodeTopic('manga.download'),
		enqueueMangaDownloadsMutation.finished.success,
		forgetMangaDownloadMutation.finished.success
	],
	target: mangaDownloadsQuery.start
})

keepFresh(mangaDownloadSettingsQuery, { triggers: [putMangaDownloadSettingsMutation.finished.success] })
