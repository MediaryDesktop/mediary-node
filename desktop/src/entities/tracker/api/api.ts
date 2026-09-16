import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type TrackerMediaType = 'anime' | 'manga'
export type TrackerCollection = NodeSchemas['EntriesOutputBody']
export type TrackerEntry = NodeSchemas['Entry']
export type TrackerList = NodeSchemas['List']
export type TrackerSource = NodeSchemas['Source']
export type TrackerTitle = NodeSchemas['Title']

export const fetchTrackerEntriesFx = createNodeRequestFx<TrackerMediaType, TrackerCollection>(mediaType => ({
	url: '/v1/tracker/entries',
	query: { type: mediaType }
}))

export type TrackerEntryPatch = Omit<NodeSchemas['UpdateEntryInputBody'], '$schema'>

export interface UpdateTrackerEntryParams {
	mediaRef: string
	patch: TrackerEntryPatch
}

export const updateTrackerEntryFx = createNodeRequestFx<UpdateTrackerEntryParams, TrackerEntry>(
	({ mediaRef, patch }) => ({
		url: `/v1/tracker/entries/${encodeURIComponent(mediaRef)}`,
		method: 'PUT',
		body: patch
	})
)
