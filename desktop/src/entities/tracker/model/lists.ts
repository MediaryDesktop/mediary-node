import { createMutation, createQuery, keepFresh } from '@farfetched/core'

import { nodeTopic } from '@infra/node'

import {
	createTrackerListFx,
	deleteTrackerListFx,
	fetchTrackerListsFx,
	renameTrackerListFx
} from '../api/api'
import type { ListMediaType, TrackerCustomList } from '../api/api'

export const LIST_MEDIA_TYPES = [
	'movie',
	'series',
	'dorama',
	'anime',
	'book',
	'manga'
] as const satisfies readonly ListMediaType[]

export const trackerListsQuery = createQuery({
	effect: fetchTrackerListsFx,
	name: 'tracker-lists'
})

export const createTrackerListMutation = createMutation({
	effect: createTrackerListFx,
	name: 'createTrackerList'
})

export const renameTrackerListMutation = createMutation({
	effect: renameTrackerListFx,
	name: 'renameTrackerList'
})

export const deleteTrackerListMutation = createMutation({
	effect: deleteTrackerListFx,
	name: 'deleteTrackerList'
})

keepFresh(trackerListsQuery, {
	triggers: [
		nodeTopic('tracker'),
		createTrackerListMutation.finished.success,
		renameTrackerListMutation.finished.success,
		deleteTrackerListMutation.finished.success
	]
})

export function listTitleCount(lists: TrackerCustomList[]): number {
	return lists.reduce((total, list) => total + list.count, 0)
}

export function listMediaTypesOf(lists: TrackerCustomList[]): ListMediaType[] {
	const present = new Set(lists.map(list => list.media_type))

	return LIST_MEDIA_TYPES.filter(type => present.has(type))
}
