import { createEffect, createEvent, createStore, sample } from 'effector'

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

export interface FolderRequest {
	content: LibraryContent
	requester?: string
}

export const libraryModel = atom(() => {
	const folderRequested = createEvent<FolderRequest>()

	// Who asked for the folder, so that the form which asked — and only it —
	// can pick the new folder once it is added.
	const $requester = createStore<string | null>(null).on(
		folderRequested,
		(_, { requester }) => requester ?? null
	)

	const pickFolderFx = createEffect<LibraryContent, AddLibraryRootParams | null>(async content => {
		const path = await window.mediary.dialog.pickFolder()

		return path === null ? null : { path, content }
	})

	sample({ clock: folderRequested, fn: ({ content }) => content, target: pickFolderFx })

	const rootAdded = sample({
		clock: addLibraryRootMutation.finished.success,
		source: $requester,
		fn: (requester, { result }) => ({ root: result.root, requester })
	})

	const rootAddFailedFor = sample({
		clock: addLibraryRootMutation.finished.failure,
		source: $requester,
		fn: (requester, { error }) => ({ error, requester })
	})

	sample({
		clock: pickFolderFx.doneData,
		filter: (picked): picked is AddLibraryRootParams => picked !== null,
		target: addLibraryRootMutation.start
	})

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
		rootAdded,
		rootAddFailedFor,
		scanRequested: startLibraryScanMutation.start,
		scanFinished,
		rootAddFailed: addLibraryRootMutation.finished.failure,
		rootDeleteFailed: deleteLibraryRootMutation.finished.failure,
		rootUpdateFailed: updateLibraryRootMutation.finished.failure
	}
})
