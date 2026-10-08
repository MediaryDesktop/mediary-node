import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type TrackerMediaType = 'anime' | 'manga' | 'movie' | 'series' | 'dorama'
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

// Only the node's own entries (movies and shows) can be removed for now.
export const deleteTrackerEntryFx = createNodeRequestFx<string, void>(mediaRef => ({
	url: `/v1/tracker/entries/${encodeURIComponent(mediaRef)}`,
	method: 'DELETE'
}))

export type TrackerCustomList = NodeSchemas['CustomList']
export type TrackerListCollection = NodeSchemas['ListsOutputBody']
export type ListMediaType = TrackerCustomList['media_type']

export const fetchTrackerListsFx = createNodeRequestFx<void, TrackerListCollection>(() => ({
	url: '/v1/tracker/lists'
}))

export interface CreateTrackerListParams {
	mediaType: ListMediaType
	name: string
	// Empty means the default icon.
	icon?: string
}

export const createTrackerListFx = createNodeRequestFx<CreateTrackerListParams, TrackerCustomList>(
	({ mediaType, name, icon }) => ({
		url: '/v1/tracker/lists',
		method: 'POST',
		body: { media_type: mediaType, name, icon: icon || undefined }
	})
)

export interface RenameTrackerListParams {
	id: string
	name: string
	// Left out keeps the current icon; empty goes back to the default.
	icon?: string
}

export const renameTrackerListFx = createNodeRequestFx<RenameTrackerListParams, TrackerCustomList>(
	({ id, name, icon }) => ({
		url: `/v1/tracker/lists/${encodeURIComponent(id)}`,
		method: 'PATCH',
		body: { name, icon }
	})
)

export const deleteTrackerListFx = createNodeRequestFx<string, void>(id => ({
	url: `/v1/tracker/lists/${encodeURIComponent(id)}`,
	method: 'DELETE'
}))
