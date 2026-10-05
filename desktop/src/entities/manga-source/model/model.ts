import { createMutation, createQuery, keepFresh } from '@farfetched/core'

import {
	checkOPDSServerFx,
	createOPDSServerFx,
	deleteMangaLinkFx,
	deleteOPDSServerFx,
	fetchMangaChaptersFx,
	fetchMangaLinksFx,
	fetchMangaSourcesFx,
	fetchOPDSServersFx,
	putMangaLinkFx,
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

// Removing a server removes the links to it, and with them its chapters.
keepFresh(mangaLinksQuery, { triggers: [...serversChanged, ...linksChanged] })

keepFresh(mangaChaptersQuery, { triggers: [...serversChanged, ...linksChanged] })
