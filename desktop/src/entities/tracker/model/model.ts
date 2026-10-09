import { createMutation, createQuery, keepFresh, update } from '@farfetched/core'
import { attach, createStore } from 'effector'

import { atom } from '@shared/factory'
import { firstPresent } from '@shared/lib'

import { nodeTopic } from '@infra/node'

import { deleteTrackerEntryFx, fetchTrackerEntriesFx, updateTrackerEntryFx } from '../api/api'
import type {
	TrackerCollection,
	TrackerEntry,
	TrackerEntryPatch,
	TrackerMediaType,
	TrackerTitle
} from '../api/api'

const trackerChanged = nodeTopic('tracker')

export const updateTrackerEntryMutation = createMutation({
	effect: updateTrackerEntryFx,
	name: 'updateTrackerEntry'
})

export const deleteTrackerEntryMutation = createMutation({
	effect: deleteTrackerEntryFx,
	name: 'deleteTrackerEntry'
})

function withEntry(collection: TrackerCollection, entry: TrackerEntry): TrackerCollection {
	const entries = collection.entries ?? []

	// A title added from search or the library is not in the collection yet.
	if (!entries.some(current => current.media_ref === entry.media_ref)) {
		return { ...collection, entries: [...entries, entry] }
	}

	return {
		...collection,
		entries: entries.map(current => (current.media_ref === entry.media_ref ? entry : current))
	}
}

function createTrackerQuery(mediaType: TrackerMediaType) {
	const query = createQuery({
		effect: attach({ effect: fetchTrackerEntriesFx, mapParams: () => mediaType }),
		name: `tracker-${mediaType}`
	})

	keepFresh(query, {
		triggers: [trackerChanged.filter({ fn: event => event.payload?.media_type === mediaType })]
	})

	update(query, {
		on: deleteTrackerEntryMutation,
		by: {
			success: ({ query: state, mutation }) => {
				if (state && 'error' in state) {
					return { error: state.error }
				}

				const current = state?.result ?? null

				if (!current) {
					return { result: current }
				}

				return {
					result: {
						...current,
						entries: (current.entries ?? []).filter(entry => entry.media_ref !== mutation.params)
					}
				}
			}
		}
	})

	update(query, {
		on: updateTrackerEntryMutation,
		by: {
			success: ({ query: state, mutation }) => {
				if (state && 'error' in state) {
					return { error: state.error }
				}

				const current = state?.result ?? null

				if (!current || mutation.result.media_type !== mediaType) {
					return { result: current }
				}

				return { result: withEntry(current, mutation.result) }
			}
		}
	})

	return query
}

export const trackerQueries = {
	anime: createTrackerQuery('anime'),
	manga: createTrackerQuery('manga'),
	movie: createTrackerQuery('movie'),
	series: createTrackerQuery('series'),
	dorama: createTrackerQuery('dorama'),
	book: createTrackerQuery('book')
} as const satisfies Record<TrackerMediaType, ReturnType<typeof createTrackerQuery>>

export const trackerModel = atom(() => {
	const $updating = createStore<Record<string, true>>({})
		.on(updateTrackerEntryFx, (updating, { mediaRef }) => ({ ...updating, [mediaRef]: true }))
		.on(updateTrackerEntryFx.finally, (updating, { params }) => {
			const next = { ...updating }
			delete next[params.mediaRef]
			return next
		})

	return {
		$updating,
		entryUpdateRequested: updateTrackerEntryMutation.start,
		entryUpdated: updateTrackerEntryMutation.finished.success,
		entryUpdateFailed: updateTrackerEntryMutation.finished.failure,
		entryDeleteRequested: deleteTrackerEntryMutation.start,
		entryDeleteFailed: deleteTrackerEntryMutation.finished.failure,
		entriesSynced: trackerChanged.filter({ fn: event => event.payload?.reason === 'synced' })
	}
})

export function formatProgress(progress: number, total: number | null | undefined): string {
	return total ? `${progress} / ${total}` : String(progress)
}

export type TrackerStatus = NonNullable<TrackerEntryPatch['status']>

export const TRACKER_STATUSES = [
	'CURRENT',
	'PLANNING',
	'COMPLETED',
	'PAUSED',
	'DROPPED',
	'REPEATING'
] as const satisfies readonly TrackerStatus[]

export function isTrackerStatus(value: string): value is TrackerStatus {
	return (TRACKER_STATUSES as readonly string[]).includes(value)
}

export const TRACKER_MEDIA_TYPES = [
	'anime',
	'manga',
	'movie',
	'series',
	'dorama',
	'book'
] as const satisfies readonly TrackerMediaType[]

export function isTrackerMediaType(value: string): value is TrackerMediaType {
	return (TRACKER_MEDIA_TYPES as readonly string[]).includes(value)
}

// Movies, shows and books are the node's own list: no AniList account, works offline.
export function isLocalTrackerType(mediaType: TrackerMediaType): boolean {
	return mediaType !== 'anime' && mediaType !== 'manga'
}

// Whether a title of this type can go on a list right now: anime and manga need
// the AniList account, the node's own types do not.
export function canTrack(mediaType: string, aniListConnected: boolean): mediaType is TrackerMediaType {
	return isTrackerMediaType(mediaType) && (aniListConnected || isLocalTrackerType(mediaType))
}

export function preferredTitle(title: TrackerTitle): string {
	return firstPresent(title.user_preferred, title.english, title.romaji, title.native)
}
