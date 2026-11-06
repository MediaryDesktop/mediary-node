import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nodeEventReceived } from '@infra/node'

import { addLibraryRootFx, deleteLibraryRootFx, fetchLibraryRootsFx, startLibraryScanFx } from '../api/api'
import type { LibraryRoot } from '../api/api'

import { libraryModel } from './model'
import { deleteLibraryRootMutation } from './queries'

const ROOT: LibraryRoot = {
	id: 1,
	path: 'D:\\Anime',
	content: 'anime',
	added_at: '2026-01-01T00:00:00Z',
	file_count: 0,
	missing_count: 0,
	unmatched_count: 0
}

const EMPTY_SCAN = {
	scan: {
		running: true,
		roots: [],
		found: 0,
		added: 0,
		changed: 0,
		reparsed: 0,
		missing: 0,
		considered: 0,
		matched: 0
	}
}

const pickFolder = vi.hoisted(() => vi.fn())

beforeEach(() => {
	pickFolder.mockReset()
	window.mediary.dialog = { pickFolder }
})

function scanEvent(phase: string, payload: Record<string, unknown> = {}) {
	return { topic: 'library.scan', at: '2026-01-01T00:00:00Z', payload: { phase, ...payload } }
}

describe('library roots', () => {
	it('adds the folder the user picked and scans it without being asked twice', async () => {
		pickFolder.mockResolvedValue('D:\\Anime')

		const addRoot = vi.fn().mockResolvedValue({ root: ROOT })
		const startScan = vi.fn().mockResolvedValue(EMPTY_SCAN)

		const scope = fork({
			handlers: [
				[addLibraryRootFx, addRoot],
				[startLibraryScanFx, startScan],
				[fetchLibraryRootsFx, () => Promise.resolve({ roots: [ROOT] })]
			]
		})

		await allSettled(libraryModel.folderRequested, { scope, params: 'anime' })

		expect(addRoot).toHaveBeenCalledWith({ path: 'D:\\Anime', content: 'anime' })
		expect(startScan).toHaveBeenCalledWith(0)
	})

	it('does nothing when the dialog is cancelled', async () => {
		pickFolder.mockResolvedValue(null)

		const addRoot = vi.fn()

		const scope = fork({ handlers: [[addLibraryRootFx, addRoot]] })

		await allSettled(libraryModel.folderRequested, { scope, params: 'anime' })

		expect(addRoot).not.toHaveBeenCalled()
	})

	it('reports a folder the node refused', async () => {
		pickFolder.mockResolvedValue('D:\\Anime\\Frieren')

		const scope = fork({
			handlers: [[addLibraryRootFx, () => Promise.reject(new Error('already covered'))]]
		})

		const failures = vi.fn()
		const unwatch = libraryModel.rootAddFailed.watch(failures)

		await allSettled(libraryModel.folderRequested, { scope, params: 'anime' })
		unwatch()

		expect(failures).toHaveBeenCalledTimes(1)
	})

	it('refreshes the library after a folder is removed', async () => {
		const roots = vi.fn().mockResolvedValue({ roots: [] })

		const scope = fork({
			handlers: [
				[deleteLibraryRootFx, () => Promise.resolve(undefined)],
				[fetchLibraryRootsFx, roots]
			]
		})

		await allSettled(deleteLibraryRootMutation.start, { scope, params: ROOT.id })

		expect(roots).toHaveBeenCalled()
	})
})

describe('scan activity', () => {
	it('follows the scan through the node events instead of polling', async () => {
		const scope = fork()

		await allSettled(nodeEventReceived, {
			scope,
			params: scanEvent('started', { roots_total: 2, roots_done: 0 })
		})
		expect(scope.getState(libraryModel.$activity)).toEqual({
			phase: 'scanning',
			found: 0,
			done: 0,
			total: 0,
			rootsDone: 0,
			rootsTotal: 2
		})

		await allSettled(nodeEventReceived, {
			scope,
			params: scanEvent('progress', { found: 128, roots_total: 2, roots_done: 0 })
		})
		expect(scope.getState(libraryModel.$activity)?.found).toBe(128)

		await allSettled(nodeEventReceived, {
			scope,
			params: scanEvent('probing', { probed: 40, total: 128, roots_total: 2, roots_done: 0 })
		})
		expect(scope.getState(libraryModel.$activity)).toMatchObject({
			phase: 'probing',
			done: 40,
			total: 128
		})

		await allSettled(nodeEventReceived, {
			scope,
			params: scanEvent('root', { roots_total: 2, roots_done: 1 })
		})
		expect(scope.getState(libraryModel.$activity)?.rootsDone).toBe(1)

		await allSettled(nodeEventReceived, {
			scope,
			params: scanEvent('matching', { matched: 3, total: 10 })
		})

		expect(scope.getState(libraryModel.$activity)).toEqual({
			phase: 'matching',
			found: 128,
			done: 3,
			total: 10,
			rootsDone: 2,
			rootsTotal: 2
		})

		await allSettled(nodeEventReceived, { scope, params: scanEvent('finished', { found: 128 }) })
		expect(scope.getState(libraryModel.$activity)).toBeNull()
	})

	it('ignores events from other topics', async () => {
		const scope = fork()

		await allSettled(nodeEventReceived, {
			scope,
			params: { topic: 'tracker', at: '2026-01-01T00:00:00Z', payload: { phase: 'progress' } }
		})

		expect(scope.getState(libraryModel.$activity)).toBeNull()
	})
})
