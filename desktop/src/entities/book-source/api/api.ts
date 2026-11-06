import { createEffect } from 'effector'

import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type BookSource = NodeSchemas['BookSource']
export type BookEdition = NodeSchemas['BookEdition']
export type BookFormat = NodeSchemas['BookFormat']
export type BookSourceOutcome = NodeSchemas['BookSourceOutcome']
export type BookDownload = NodeSchemas['BookDownload']
export type BookOPDSServer = NodeSchemas['BookOPDSServerBody']
export type BookOPDSServerInput = NodeSchemas['BookOPDSServerInputBody']
export type BookOPDSCheckInput = NodeSchemas['CheckBookOPDSServerInputBody']
export type BookOPDSCheckResult = NodeSchemas['CheckBookOPDSServerOutputBody']
export type EnqueueBookDownloadInput = NodeSchemas['EnqueueBookDownloadInputBody']

export const fetchBookSourcesFx = createNodeRequestFx<void, NodeSchemas['BookSourcesOutputBody']>(() => ({
	url: '/v1/books/sources'
}))

const requestBookEditionsFx = createNodeRequestFx<string, NodeSchemas['SearchBookEditionsOutputBody']>(
	mediaRef => ({
		url: '/v1/books/editions',
		query: { media_ref: mediaRef },

		timeout: 30_000
	})
)

export const fetchBookEditionsFx = createEffect(async (mediaRef: string) => ({
	mediaRef,
	...(await requestBookEditionsFx(mediaRef))
}))

export const fetchBookDownloadsFx = createNodeRequestFx<void, NodeSchemas['BookDownloadsOutputBody']>(() => ({
	url: '/v1/books/downloads'
}))

export const enqueueBookDownloadFx = createNodeRequestFx<EnqueueBookDownloadInput, BookDownload>(body => ({
	url: '/v1/books/downloads',
	method: 'POST',
	body
}))

export const cancelBookDownloadFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/books/downloads/${id}/cancel`,
	method: 'POST'
}))

export const retryBookDownloadFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/books/downloads/${id}/retry`,
	method: 'POST'
}))

export const forgetBookDownloadFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/books/downloads/${id}`,
	method: 'DELETE'
}))

export const fetchBookDownloadSettingsFx = createNodeRequestFx<void, NodeSchemas['BookDownloadSettings']>(
	() => ({ url: '/v1/books/downloads/settings' })
)

export const putBookDownloadSettingsFx = createNodeRequestFx<number, NodeSchemas['BookDownloadSettings']>(
	rootId => ({ url: '/v1/books/downloads/settings', method: 'PUT', body: { root_id: rootId } })
)

export const fetchBookOPDSServersFx = createNodeRequestFx<void, NodeSchemas['BookOPDSServersOutputBody']>(
	() => ({ url: '/v1/books/opds/servers' })
)

export const createBookOPDSServerFx = createNodeRequestFx<
	BookOPDSServerInput,
	NodeSchemas['BookOPDSServerOutputBody']
>(body => ({ url: '/v1/books/opds/servers', method: 'POST', body }))

export interface UpdateBookOPDSServerParams {
	id: number
	body: BookOPDSServerInput
}

export const updateBookOPDSServerFx = createNodeRequestFx<
	UpdateBookOPDSServerParams,
	NodeSchemas['BookOPDSServerOutputBody']
>(({ id, body }) => ({ url: `/v1/books/opds/servers/${id}`, method: 'PUT', body }))

export const deleteBookOPDSServerFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/books/opds/servers/${id}`,
	method: 'DELETE'
}))

export const checkBookOPDSServerFx = createNodeRequestFx<BookOPDSCheckInput, BookOPDSCheckResult>(body => ({
	url: '/v1/books/opds/check',
	method: 'POST',
	body,

	timeout: 35_000
}))
