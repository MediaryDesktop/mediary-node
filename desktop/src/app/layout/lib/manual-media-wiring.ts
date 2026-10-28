import { createStore, sample } from 'effector'

import { setLibraryMatchesMutation } from '@entities/library-item'
import type { SetLibraryMatchParams } from '@entities/library-item'

import { manualMediaModel } from '@features/manage-manual-media'
import { unmatchedFilesModel } from '@features/manage-unmatched-files'
import type { ManualTitleRequest } from '@features/manage-unmatched-files'

// Two features that do not know each other: files no source could name ask for a
// title the user describes, and get matched to it once it exists. The user stays
// in the unmatched files rather than being taken to the new title's page.
const $waitingFiles = createStore<ManualTitleRequest['files']>([]).on(
	unmatchedFilesModel.manualTitleRequested,
	(_, { files }) => files
)

sample({
	clock: unmatchedFilesModel.manualTitleRequested,
	fn: ({ mediaType, title }) => ({ mediaType, title, stay: true }),
	target: manualMediaModel.createRequested
})

// A title made from search does not stay; only the one asked for here does, and
// that request has just replaced whatever files an abandoned one left behind.
const filesMatched = sample({
	clock: manualMediaModel.created,
	source: $waitingFiles,
	filter: (files, { stay }) => stay && files.length > 0,
	fn: (files, { mediaRef }): SetLibraryMatchParams[] => files.map(file => ({ ...file, mediaRef }))
})

sample({ clock: filesMatched, target: setLibraryMatchesMutation.start })

$waitingFiles.reset(filesMatched)
