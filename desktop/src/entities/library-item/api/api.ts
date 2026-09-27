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

export const addLibraryRootFx = createNodeRequestFx<string, NodeSchemas['RootOutputBody']>(path => ({
	url: '/v1/library/roots',
	method: 'POST',
	body: { path }
}))

export const deleteLibraryRootFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/library/roots/${id}`,
	method: 'DELETE'
}))

export interface LibraryFileQuery {
	rootId?: number
	kind?: LibraryFileKind
	form?: LibraryMediaForm
	unmatched?: boolean
	limit?: number
	offset?: number
}

export const fetchLibraryFilesFx = createNodeRequestFx<LibraryFileQuery, NodeSchemas['FilesOutputBody']>(
	query => ({
		url: '/v1/library/files',
		query: {
			root_id: query.rootId,
			kind: query.kind,
			form: query.form,
			unmatched: query.unmatched,
			limit: query.limit,
			offset: query.offset
		}
	})
)

export const fetchLibraryScanFx = createNodeRequestFx<void, NodeSchemas['ScanOutputBody']>(() => ({
	url: '/v1/library/scan'
}))

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
