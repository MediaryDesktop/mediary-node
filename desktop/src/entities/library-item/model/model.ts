import { createEffect, createEvent, sample } from 'effector'

import { atom } from '@shared/factory'

import type { AddLibraryRootParams, LibraryContent } from '../api/api'

import {
	addLibraryRootMutation,
	deleteLibraryRootMutation,
	libraryRootsQuery,
	startLibraryScanMutation,
	updateLibraryRootMutation
} from './queries'
import { createScanActivity, scanFinished } from './scan'

export const libraryModel = atom(() => {
	const folderRequested = createEvent<LibraryContent>()

	const pickFolderFx = createEffect<LibraryContent, AddLibraryRootParams | null>(async content => {
		const path = await window.mediary.dialog.pickFolder()

		return path === null ? null : { path, content }
	})

	sample({ clock: folderRequested, target: pickFolderFx })

	// A cancelled dialog is an answer, not a failure: nothing happens.
	sample({
		clock: pickFolderFx.doneData,
		filter: (picked): picked is AddLibraryRootParams => picked !== null,
		target: addLibraryRootMutation.start
	})

	// A folder is added to be scanned; making the user press scan straight after
	// would be asking them to confirm what they just asked for.
	sample({
		clock: addLibraryRootMutation.finished.success,
		fn: (): number => 0,
		target: startLibraryScanMutation.start
	})

	sample({
		clock: [
			addLibraryRootMutation.finished.success,
			updateLibraryRootMutation.finished.success,
			deleteLibraryRootMutation.finished.success
		],
		target: libraryRootsQuery.start
	})

	const $activity = createScanActivity()

	return {
		$activity,
		$pickingFolder: pickFolderFx.pending,
		folderRequested,
		scanRequested: startLibraryScanMutation.start,
		scanFinished,
		rootAddFailed: addLibraryRootMutation.finished.failure,
		rootDeleteFailed: deleteLibraryRootMutation.finished.failure,
		rootUpdateFailed: updateLibraryRootMutation.finished.failure
	}
})
