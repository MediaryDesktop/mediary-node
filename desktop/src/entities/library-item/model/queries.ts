import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { createEffect } from 'effector'

import { nodeStreamResumed, nodeTopic } from '@infra/node'

import {
	addLibraryRootFx,
	deleteLibraryFileFx,
	deleteLibraryMatchFx,
	deleteLibraryRootFx,
	fetchLibraryCandidatesFx,
	fetchLibraryCollectionFx,
	fetchLibraryRootsFx,
	fetchLibraryScanFx,
	fetchLibraryScanHistoryFx,
	fetchLibraryScanRunFx,
	fetchLibraryTreeFx,
	fetchTitleFilesFx,
	setLibraryFileIgnoredFx,
	setLibraryMatchFx,
	startLibraryScanFx,
	updateLibraryRootFx
} from '../api/api'
import type { SetLibraryFileIgnoredParams, SetLibraryMatchParams } from '../api/api'

const libraryUpdated = nodeTopic('library.update')

export const libraryRootsQuery = createQuery({ effect: fetchLibraryRootsFx, name: 'libraryRoots' })

export const libraryCollectionQuery = createQuery({
	effect: fetchLibraryCollectionFx,
	name: 'libraryCollection'
})

export const libraryTreeQuery = createQuery({ effect: fetchLibraryTreeFx, name: 'libraryTree' })

export const titleFilesQuery = createQuery({ effect: fetchTitleFilesFx, name: 'titleFiles' })

concurrency(titleFilesQuery, { strategy: 'TAKE_LATEST' })

export const libraryScanQuery = createQuery({ effect: fetchLibraryScanFx, name: 'libraryScan' })

export const libraryScanHistoryQuery = createQuery({
	effect: fetchLibraryScanHistoryFx,
	name: 'libraryScanHistory'
})

export const libraryScanRunQuery = createQuery({ effect: fetchLibraryScanRunFx, name: 'libraryScanRun' })

export const libraryCandidatesQuery = createQuery({
	effect: fetchLibraryCandidatesFx,
	name: 'libraryCandidates'
})

export const addLibraryRootMutation = createMutation({ effect: addLibraryRootFx, name: 'addLibraryRoot' })

export const updateLibraryRootMutation = createMutation({
	effect: updateLibraryRootFx,
	name: 'updateLibraryRoot'
})

export const deleteLibraryRootMutation = createMutation({
	effect: deleteLibraryRootFx,
	name: 'deleteLibraryRoot'
})

export const startLibraryScanMutation = createMutation({
	effect: startLibraryScanFx,
	name: 'startLibraryScan'
})

export const setLibraryMatchMutation = createMutation({ effect: setLibraryMatchFx, name: 'setLibraryMatch' })

export const setLibraryFileIgnoredMutation = createMutation({
	effect: setLibraryFileIgnoredFx,
	name: 'setLibraryFileIgnored'
})

export const deleteLibraryFileMutation = createMutation({
	effect: deleteLibraryFileFx,
	name: 'deleteLibraryFile'
})

export interface BulkOutcome {
	done: number
	failed: number
}

async function settle<Params>(
	items: Params[],
	run: (item: Params) => Promise<unknown>
): Promise<BulkOutcome> {
	const results = await Promise.allSettled(items.map(run))
	const failed = results.filter(result => result.status === 'rejected').length

	return { done: results.length - failed, failed }
}

export const setLibraryMatchesMutation = createMutation({
	effect: createEffect((items: SetLibraryMatchParams[]) => settle(items, item => setLibraryMatchFx(item))),
	name: 'setLibraryMatches'
})

export const setLibraryFilesIgnoredMutation = createMutation({
	effect: createEffect((items: SetLibraryFileIgnoredParams[]) =>
		settle(items, item => setLibraryFileIgnoredFx(item))
	),
	name: 'setLibraryFilesIgnored'
})

export const deleteLibraryFilesMutation = createMutation({
	effect: createEffect((fileIds: number[]) => settle(fileIds, fileId => deleteLibraryFileFx(fileId))),
	name: 'deleteLibraryFiles'
})

export const deleteLibraryMatchesMutation = createMutation({
	effect: createEffect((fileIds: number[]) => settle(fileIds, fileId => deleteLibraryMatchFx(fileId))),
	name: 'deleteLibraryMatches'
})

export const deleteLibraryMatchMutation = createMutation({
	effect: deleteLibraryMatchFx,
	name: 'deleteLibraryMatch'
})

keepFresh(libraryRootsQuery, { triggers: [libraryUpdated, nodeStreamResumed] })

const filesChanged = [
	libraryUpdated,
	nodeStreamResumed,
	setLibraryMatchMutation.finished.success,
	deleteLibraryMatchMutation.finished.success,
	setLibraryFileIgnoredMutation.finished.success,
	deleteLibraryFileMutation.finished.success,
	setLibraryMatchesMutation.finished.success,
	setLibraryFilesIgnoredMutation.finished.success,
	deleteLibraryFilesMutation.finished.success,
	deleteLibraryMatchesMutation.finished.success
]

keepFresh(libraryCollectionQuery, { triggers: filesChanged })

keepFresh(libraryTreeQuery, { triggers: filesChanged })

keepFresh(titleFilesQuery, { triggers: filesChanged })
