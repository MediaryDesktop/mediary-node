import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type LibraryRoot = NodeSchemas['Root']
export type LibraryFile = NodeSchemas['File']
export type LibraryFilePage = NodeSchemas['FilePage']
export type LibraryFileParsed = NodeSchemas['Parsed']
export type LibraryFileMatch = NodeSchemas['Match']
export type LibraryScan = NodeSchemas['ScanStatus']
export type LibraryScanRoot = NodeSchemas['ScanRootResult']
export type LibrarySuggestion = NodeSchemas['Suggestion']
export type LibraryTitle = NodeSchemas['MatchedTitle']
export type LibraryCounts = NodeSchemas['Counts']
export type LibraryCollection = NodeSchemas['LibraryCollection']
export type LibraryCollectionEntry = NodeSchemas['LibraryCollectionEntry']
export type LibraryScanRunSummary = NodeSchemas['ScanRunSummary']
export type LibraryScanRunDetail = NodeSchemas['ScanRunDetail']
export type LibraryScanHistoryPage = NodeSchemas['ScanHistoryPage']
export type LibraryScanRunGroup = NodeSchemas['ScanRunGroupDetail']
export type LibraryScanRunFileLog = NodeSchemas['ScanRunFileLogDetail']

export type LibraryFileKind = LibraryFile['kind']
export type LibraryMediaForm = NonNullable<LibraryFileParsed['form']>

export const fetchLibraryRootsFx = createNodeRequestFx<void, NodeSchemas['RootsOutputBody']>(() => ({
	url: '/v1/library/roots'
}))

// What a folder's videos are: anime goes to AniList, movies and shows to TMDB.
export type LibraryContent = LibraryRoot['content']

export interface AddLibraryRootParams {
	path: string
	content: LibraryContent
}

export const addLibraryRootFx = createNodeRequestFx<AddLibraryRootParams, NodeSchemas['RootOutputBody']>(
	({ path, content }) => ({
		url: '/v1/library/roots',
		method: 'POST',
		body: { path, content }
	})
)

export interface UpdateLibraryRootParams {
	id: number
	content: LibraryContent
}

export const updateLibraryRootFx = createNodeRequestFx<
	UpdateLibraryRootParams,
	NodeSchemas['RootOutputBody']
>(({ id, content }) => ({
	url: `/v1/library/roots/${id}`,
	method: 'PATCH',
	body: { content }
}))

export const deleteLibraryRootFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/library/roots/${id}`,
	method: 'DELETE'
}))

export const fetchLibraryTreeFx = createNodeRequestFx<void, NodeSchemas['FilesOutputBody']>(() => ({
	url: '/v1/library/files/tree',

	// The whole library at once, which on a big one is a lot of rows to build.
	timeout: 20_000
}))

// One title's files. 500 is the node's page ceiling and far above any real
// season count, so a title page never has to page.
export interface TitleFilesParams {
	mediaRef: string
	kind: 'video' | 'manga'
}

// One title's files of one kind. 500 is the node's page ceiling and far above any
// real season or volume count, so a title page never has to page.
export const fetchTitleFilesFx = createNodeRequestFx<TitleFilesParams, NodeSchemas['FilesOutputBody']>(
	({ mediaRef, kind }) => ({
		url: '/v1/library/files',
		query: { media_ref: mediaRef, kind, limit: 500 }
	})
)

export const fetchLibraryScanFx = createNodeRequestFx<void, NodeSchemas['ScanOutputBody']>(() => ({
	url: '/v1/library/scan'
}))

export const fetchLibraryCollectionFx = createNodeRequestFx<void, NodeSchemas['CollectionOutputBody']>(
	() => ({
		url: '/v1/library/collection'
	})
)

// 0 scans every root, which is what the page's button means.
export const startLibraryScanFx = createNodeRequestFx<number | void, NodeSchemas['ScanOutputBody']>(
	rootId => ({
		url: '/v1/library/scan',
		method: 'POST',
		body: { root_id: rootId ?? 0 }
	})
)

export interface SetLibraryMatchParams {
	fileId: number
	mediaRef: string
	season?: number
	episode?: number
}

export const setLibraryMatchFx = createNodeRequestFx<SetLibraryMatchParams, NodeSchemas['FileOutputBody']>(
	({ fileId, mediaRef, season, episode }) => ({
		url: `/v1/library/files/${fileId}/match`,
		method: 'PUT',
		body: { media_ref: mediaRef, season, episode }
	})
)

export interface SetLibraryFileIgnoredParams {
	fileId: number
	ignored: boolean
}

export const setLibraryFileIgnoredFx = createNodeRequestFx<
	SetLibraryFileIgnoredParams,
	NodeSchemas['FileOutputBody']
>(({ fileId, ignored }) => ({
	url: `/v1/library/files/${fileId}/ignore`,
	method: 'PUT',
	body: { ignored }
}))

export const deleteLibraryFileFx = createNodeRequestFx<number, void>(fileId => ({
	url: `/v1/library/files/${fileId}`,
	method: 'DELETE'
}))

export const deleteLibraryMatchFx = createNodeRequestFx<number, void>(fileId => ({
	url: `/v1/library/files/${fileId}/match`,
	method: 'DELETE'
}))

export const fetchLibraryCandidatesFx = createNodeRequestFx<number, NodeSchemas['SuggestionsOutputBody']>(
	fileId => ({
		url: `/v1/library/files/${fileId}/candidates`,

		// The node may have to ask AniList before it can answer.
		timeout: 20_000
	})
)

export interface LibraryScanHistoryQuery {
	from?: string
	to?: string
	limit?: number
	offset?: number
}

export const fetchLibraryScanHistoryFx = createNodeRequestFx<
	LibraryScanHistoryQuery,
	NodeSchemas['ScanHistoryOutputBody']
>(query => ({
	url: '/v1/library/scan/history',
	query: { from: query.from, to: query.to, limit: query.limit, offset: query.offset }
}))

export const fetchLibraryScanRunFx = createNodeRequestFx<number, NodeSchemas['ScanRunOutputBody']>(id => ({
	url: `/v1/library/scan/history/${id}`
}))
