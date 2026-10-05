import { createEffect } from 'effector'

import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type OPDSServer = NodeSchemas['OPDSServerBody']
export type OPDSServerInput = NodeSchemas['OPDSServerInputBody']
export type OPDSCheckInput = NodeSchemas['CheckOPDSServerInputBody']
export type OPDSCheckResult = NodeSchemas['CheckOPDSServerOutputBody']
export type MangaSource = NodeSchemas['MangaSourceBody']
export type MangaSeries = NodeSchemas['MangaSeriesBody']
export type MangaLink = NodeSchemas['MangaLinkBody']
export type MangaChapter = NodeSchemas['MangaChapterBody']
export type MangaSourceProblem = NodeSchemas['MangaSourceProblemBody']

// A media reference and a source both hold colons; the path segment gets them escaped.
const segment = encodeURIComponent

export const fetchOPDSServersFx = createNodeRequestFx<void, NodeSchemas['OPDSServersOutputBody']>(() => ({
	url: '/v1/manga/opds/servers'
}))

export const createOPDSServerFx = createNodeRequestFx<OPDSServerInput, NodeSchemas['OPDSServerOutputBody']>(
	body => ({ url: '/v1/manga/opds/servers', method: 'POST', body })
)

export interface UpdateOPDSServerParams {
	id: number
	body: OPDSServerInput
}

export const updateOPDSServerFx = createNodeRequestFx<
	UpdateOPDSServerParams,
	NodeSchemas['OPDSServerOutputBody']
>(({ id, body }) => ({ url: `/v1/manga/opds/servers/${id}`, method: 'PUT', body }))

export const deleteOPDSServerFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/manga/opds/servers/${id}`,
	method: 'DELETE'
}))

export const checkOPDSServerFx = createNodeRequestFx<OPDSCheckInput, OPDSCheckResult>(body => ({
	url: '/v1/manga/opds/check',
	method: 'POST',
	body,

	// The node waits on the user's server, which may be slow to wake up.
	timeout: 35_000
}))

export const fetchMangaSourcesFx = createNodeRequestFx<void, NodeSchemas['MangaSourcesOutputBody']>(() => ({
	url: '/v1/manga/sources'
}))

export interface SearchMangaSourceParams {
	source: string
	query: string
}

export const searchMangaSourceFx = createNodeRequestFx<
	SearchMangaSourceParams,
	NodeSchemas['MangaSearchOutputBody']
>(({ source, query }) => ({
	url: `/v1/manga/sources/${segment(source)}/search`,
	query: { q: query },
	timeout: 35_000
}))

const requestMangaLinksFx = createNodeRequestFx<string, NodeSchemas['MangaLinksOutputBody']>(mediaRef => ({
	url: `/v1/manga/titles/${segment(mediaRef)}/links`
}))

// The answer says which title it is for: one query serves every title page, and a
// page must not show the last title's links while its own are on the way.
export const fetchMangaLinksFx = createEffect(async (mediaRef: string) => ({
	mediaRef,
	...(await requestMangaLinksFx(mediaRef))
}))

export interface PutMangaLinkParams {
	mediaRef: string
	source: string
	seriesId: string
	seriesTitle: string
}

export const putMangaLinkFx = createNodeRequestFx<PutMangaLinkParams, void>(
	({ mediaRef, source, seriesId, seriesTitle }) => ({
		url: `/v1/manga/titles/${segment(mediaRef)}/links/${segment(source)}`,
		method: 'PUT',
		body: { series_id: seriesId, series_title: seriesTitle }
	})
)

export interface DeleteMangaLinkParams {
	mediaRef: string
	source: string
}

export const deleteMangaLinkFx = createNodeRequestFx<DeleteMangaLinkParams, void>(({ mediaRef, source }) => ({
	url: `/v1/manga/titles/${segment(mediaRef)}/links/${segment(source)}`,
	method: 'DELETE'
}))

const requestMangaChaptersFx = createNodeRequestFx<string, NodeSchemas['MangaChaptersOutputBody']>(
	mediaRef => ({
		url: `/v1/manga/titles/${segment(mediaRef)}/chapters`,

		// Every linked server is asked in turn, and a big series is several pages.
		timeout: 60_000
	})
)

export const fetchMangaChaptersFx = createEffect(async (mediaRef: string) => ({
	mediaRef,
	...(await requestMangaChaptersFx(mediaRef))
}))
