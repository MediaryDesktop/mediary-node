import { createMutation, createQuery, keepFresh } from '@farfetched/core'
import { attach, createEffect, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'

import { nodeTopic } from '@infra/node'

import {
	addLibraryRootFx,
	deleteLibraryMatchFx,
	deleteLibraryRootFx,
	fetchLibraryCandidatesFx,
	fetchLibraryFilesFx,
	fetchLibraryRootsFx,
	fetchLibraryScanFx,
	setLibraryMatchFx,
	startLibraryScanFx
} from '../api/api'
import type { LibraryFile } from '../api/api'

// How many files one page request brings in. The node pages at 500, and a list
// this long is already past what anyone scrolls — the count in the header says
// how many more there are.
export const LIBRARY_PAGE_SIZE = 500

const libraryUpdated = nodeTopic('library.update')
const libraryScanEvent = nodeTopic('library.scan')

function scanPhase(phase: string) {
	return libraryScanEvent.filter({ fn: event => event.payload?.phase === phase })
}

const scanStarted = scanPhase('started')
const scanProgressed = scanPhase('progress')
const scanMatching = scanPhase('matching')
const scanFinished = scanPhase('finished')

export const libraryRootsQuery = createQuery({ effect: fetchLibraryRootsFx, name: 'libraryRoots' })

export const libraryFilesQuery = createQuery({
	effect: attach({ effect: fetchLibraryFilesFx, mapParams: () => ({ limit: LIBRARY_PAGE_SIZE }) }),
	name: 'libraryFiles'
})

export const libraryScanQuery = createQuery({ effect: fetchLibraryScanFx, name: 'libraryScan' })

export const libraryCandidatesQuery = createQuery({
	effect: fetchLibraryCandidatesFx,
	name: 'libraryCandidates'
})

export const addLibraryRootMutation = createMutation({ effect: addLibraryRootFx, name: 'addLibraryRoot' })

export const deleteLibraryRootMutation = createMutation({
	effect: deleteLibraryRootFx,
	name: 'deleteLibraryRoot'
})

export const startLibraryScanMutation = createMutation({
	effect: startLibraryScanFx,
	name: 'startLibraryScan'
})

export const setLibraryMatchMutation = createMutation({ effect: setLibraryMatchFx, name: 'setLibraryMatch' })

export const deleteLibraryMatchMutation = createMutation({
	effect: deleteLibraryMatchFx,
	name: 'deleteLibraryMatch'
})

// The node says when its own rows changed, so nothing here polls: a scan that
// finds a file, a match the matcher worked out, a folder that was removed — each
// arrives as an event, and the query refetches once.
keepFresh(libraryRootsQuery, { triggers: [libraryUpdated] })

keepFresh(libraryFilesQuery, {
	triggers: [
		libraryUpdated,
		setLibraryMatchMutation.finished.success,
		deleteLibraryMatchMutation.finished.success
	]
})

keepFresh(libraryScanQuery, { triggers: [scanStarted, scanFinished] })

export interface ScanActivity {
	phase: 'scanning' | 'matching'
	found: number
	matched: number
	total: number
}

function activityNumber(payload: Record<string, unknown> | undefined, key: string): number {
	const value = payload?.[key]

	return typeof value === 'number' ? value : 0
}

export const libraryModel = atom(() => {
	const folderRequested = createEvent()

	const pickFolderFx = createEffect<void, string | null>(() => window.mediary.dialog.pickFolder())

	sample({ clock: folderRequested, target: pickFolderFx })

	// A cancelled dialog is an answer, not a failure: nothing happens.
	sample({
		clock: pickFolderFx.doneData,
		filter: (path): path is string => path !== null,
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
		clock: [addLibraryRootMutation.finished.success, deleteLibraryRootMutation.finished.success],
		target: [libraryRootsQuery.start, libraryFilesQuery.start]
	})

	// Progress is read off the events rather than refetched: during a scan they
	// arrive several times a second, and the node already says everything the
	// header needs.
	const $activity = createStore<ScanActivity | null>(null)
		.on(scanStarted, () => ({ phase: 'scanning' as const, found: 0, matched: 0, total: 0 }))
		.on(scanProgressed, (current, event) => ({
			phase: 'scanning' as const,
			found: activityNumber(event.payload, 'found'),
			matched: current?.matched ?? 0,
			total: current?.total ?? 0
		}))
		.on(scanMatching, (current, event) => ({
			phase: 'matching' as const,
			found: current?.found ?? 0,
			matched: activityNumber(event.payload, 'matched'),
			total: activityNumber(event.payload, 'total')
		}))
		.reset(scanFinished, libraryScanQuery.finished.success)

	return {
		$activity,
		$pickingFolder: pickFolderFx.pending,
		folderRequested,
		scanRequested: startLibraryScanMutation.start,
		scanFinished,
		rootAddFailed: addLibraryRootMutation.finished.failure,
		rootDeleteFailed: deleteLibraryRootMutation.finished.failure
	}
})

export function isMatched(file: LibraryFile): boolean {
	return file.match !== undefined && file.match !== null
}

// An opening or a trailer belongs to no episode, so the node never matches it and
// the library does not offer to.
export function isTrackable(file: LibraryFile): boolean {
	return file.parsed.form !== 'extra'
}

export function fileTitle(file: LibraryFile): string {
	const parsed = file.parsed.title?.trim()

	return parsed && parsed !== '' ? parsed : file.rel_path
}

export function fileNumber(file: LibraryFile): number | null {
	return file.parsed.episode ?? file.parsed.chapter ?? null
}
