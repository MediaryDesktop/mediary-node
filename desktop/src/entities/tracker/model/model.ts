import { createMutation, createQuery, keepFresh, update } from '@farfetched/core'
import { attach, createStore } from 'effector'

import { atom } from '@shared/factory'

import { nodeTopic } from '@infra/node'

import { deleteTrackerEntryFx, fetchTrackerEntriesFx, updateTrackerEntryFx } from '../api/api'
import type { TrackerCollection, TrackerEntry, TrackerMediaType } from '../api/api'

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
