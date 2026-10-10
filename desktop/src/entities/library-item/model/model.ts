import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'
import { createEffect, createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { formatDuration } from '@shared/lib'

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
import type {
	AddLibraryRootParams,
	LibraryContent,
	LibraryFile,
	SetLibraryFileIgnoredParams,
	SetLibraryMatchParams
} from '../api/api'

const libraryUpdated = nodeTopic('library.update')
const libraryScanEvent = nodeTopic('library.scan')

function scanPhase(phase: string) {
	return libraryScanEvent.filter({ fn: event => event.payload?.phase === phase })
}

const scanStarted = scanPhase('started')
const scanProgressed = scanPhase('progress')
const scanRootDone = scanPhase('root')
const scanProbing = scanPhase('probing')
const scanMatching = scanPhase('matching')
const scanFinished = scanPhase('finished')

export const libraryRootsQuery = createQuery({ effect: fetchLibraryRootsFx, name: 'libraryRoots' })

export const libraryCollectionQuery = createQuery({
	effect: fetchLibraryCollectionFx,
	name: 'libraryCollection'
})

export const libraryTreeQuery = createQuery({ effect: fetchLibraryTreeFx, name: 'libraryTree' })

export const titleFilesQuery = createQuery({ effect: fetchTitleFilesFx, name: 'titleFiles' })

// Several pages and drawers share this one for their own title's files; without
// this, one of their requests landing after a newer one would overwrite $data
// with a different title's files, and the one still filtering for its own
// media_ref would come up empty until something else happened to refetch it.
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

// What a group action did: how many of the files it went through and how many
// it could not. A file that is open in a player cannot be deleted, and one
// failure should not throw away what happened to the other ninety-nine.
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

// The node says when its own rows changed, so nothing here polls: a scan that
// finds a file, a match the matcher worked out, a folder that was removed — each
// arrives as an event, and the query refetches once.
keepFresh(libraryRootsQuery, { triggers: [libraryUpdated, nodeStreamResumed] })

keepFresh(libraryCollectionQuery, {
	triggers: [
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
})

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

keepFresh(libraryTreeQuery, { triggers: filesChanged })

keepFresh(titleFilesQuery, { triggers: filesChanged })

keepFresh(libraryScanQuery, { triggers: [scanStarted, scanFinished] })

keepFresh(libraryScanHistoryQuery, { triggers: [scanFinished] })

export type ScanPhase = 'scanning' | 'probing' | 'matching'

export interface ScanActivity {
	phase: ScanPhase

	found: number

	// done and total belong to whichever phase is running: files probed of files
	// to probe, then titles matched of titles to match. One pair rather than a
	// pair per phase, because the bar only ever shows one of them.
	done: number
	total: number

	rootsDone: number
	rootsTotal: number
}

function activityNumber(payload: Record<string, unknown> | undefined, key: string, fallback = 0): number {
	const value = payload?.[key]

	return typeof value === 'number' ? value : fallback
}

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

	// Progress is read off the events rather than refetched: during a scan they
	// arrive several times a second, and the node already says everything the
	// header needs.
	const idle: ScanActivity = {
		phase: 'scanning',
		found: 0,
		done: 0,
		total: 0,
		rootsDone: 0,
		rootsTotal: 0
	}

	const $activity = createStore<ScanActivity | null>(null)
		.on(scanStarted, (_, event) => ({
			...idle,
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on([scanProgressed, scanRootDone], (current, event) => ({
			...(current ?? idle),
			phase: 'scanning' as const,
			found: activityNumber(event.payload, 'found', current?.found ?? 0),
			done: 0,
			total: 0,
			rootsDone: activityNumber(event.payload, 'roots_done'),
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on(scanProbing, (current, event) => ({
			...(current ?? idle),
			phase: 'probing' as const,
			done: activityNumber(event.payload, 'probed'),
			total: activityNumber(event.payload, 'total'),
			rootsDone: activityNumber(event.payload, 'roots_done'),
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on(scanMatching, (current, event) => ({
			...(current ?? idle),
			phase: 'matching' as const,
			done: activityNumber(event.payload, 'matched'),
			total: activityNumber(event.payload, 'total'),

			// Matching runs once every folder is walked, so the folder count is
			// complete by definition.
			rootsDone: current?.rootsTotal ?? 0
		}))
		.reset(scanFinished, libraryScanQuery.finished.success)

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

export function isMatched(file: LibraryFile): boolean {
	return file.match !== undefined && file.match !== null
}

// An opening or a trailer belongs to no episode, so the node never matches it and
// the library does not offer to.
export function isIgnored(file: LibraryFile): boolean {
	return file.ignored
}

export function isTrackable(file: LibraryFile): boolean {
	return file.parsed.form !== 'extra'
}

export function fileTitle(file: LibraryFile): string {
	const parsed = file.parsed.title?.trim()

	return parsed && parsed !== '' ? parsed : file.rel_path
}

// The file's own name, which is what a row about a file should say. rel_path is
// the whole path under the root, and a list of episodes repeats the folder part
// of it on every line for nothing.
export function fileName(file: LibraryFile): string {
	const parts = file.rel_path.split('/')

	return parts[parts.length - 1] || file.rel_path
}

export function fileNumber(file: LibraryFile): number | null {
	return file.parsed.episode ?? file.parsed.chapter ?? null
}

// Which season the file belongs to. The match is asked first because it is what
// the user or the matcher settled on; the name is what the scan read off the file
// itself, which for "s02e01_720.mp4" already says season two.
export function fileSeason(file: LibraryFile): number | null {
	return file.match?.season ?? file.parsed.season ?? null
}

// How long the file runs, as the scan read it out of the container. A container
// the node cannot read leaves this empty, and the row simply shows no time.
export function fileDuration(file: LibraryFile): string | null {
	return file.duration_seconds ? formatDuration(file.duration_seconds) : null
}
