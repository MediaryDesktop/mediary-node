import { allSettled, fork } from 'effector'
import { describe, expect, it } from 'vitest'

import { createTrackerListFx, fetchTrackerListsFx } from '@entities/tracker'
import type { CreateTrackerListParams, TrackerCustomList } from '@entities/tracker'

import { manageListsModel } from '@features/manage-lists'
import { manageEntryModel } from '@features/track-media'

import './list-wiring'

function created(name: string, mediaType: TrackerCustomList['media_type']): TrackerCustomList {
	return { id: 'local:1', provider: 'local', media_type: mediaType, name, count: 0, covers: [] }
}

describe('a list made while adding a title', () => {
	it('opens on top with the title’s type and comes back ticked', async () => {
		const scope = fork({
			handlers: [
				[fetchTrackerListsFx, () => Promise.resolve({ lists: [], sources: [] })],
				[
					createTrackerListFx,
					({ name, mediaType }: CreateTrackerListParams) =>
						Promise.resolve(created(name, mediaType))
				]
			]
		})

		await allSettled(manageEntryModel.addOpened, {
			scope,
			params: { mediaRef: 'tmdb:movie:603', mediaType: 'movie', title: 'The Matrix' }
		})
		await allSettled(manageEntryModel.createListRequested, { scope })

		expect(scope.getState(manageListsModel.$open)).toBe(true)
		expect(scope.getState(manageListsModel.$mediaType)).toBe('movie')

		await allSettled(manageListsModel.nameChanged, { scope, params: 'Sci-fi' })
		await allSettled(manageListsModel.submitted, { scope })

		expect(scope.getState(manageListsModel.$open)).toBe(false)
		expect(scope.getState(manageEntryModel.$open)).toBe(true)
		expect(scope.getState(manageEntryModel.$lists)).toEqual(['Sci-fi'])
	})

	it('leaves the title’s lists alone when the list is of another type', async () => {
		const scope = fork({
			handlers: [
				[fetchTrackerListsFx, () => Promise.resolve({ lists: [], sources: [] })],
				[
					createTrackerListFx,
					({ name }: CreateTrackerListParams) => Promise.resolve(created(name, 'series'))
				]
			]
		})

		await allSettled(manageEntryModel.addOpened, {
			scope,
			params: { mediaRef: 'tmdb:movie:603', mediaType: 'movie', title: 'The Matrix' }
		})
		await allSettled(manageEntryModel.createListRequested, { scope })
		await allSettled(manageListsModel.nameChanged, { scope, params: 'Shows' })
		await allSettled(manageListsModel.submitted, { scope })

		expect(scope.getState(manageEntryModel.$lists)).toEqual([])
	})
})
