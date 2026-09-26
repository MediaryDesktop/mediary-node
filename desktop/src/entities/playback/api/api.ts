import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type PlaybackStatus = NodeSchemas['PlaybackStatus']
export type PlaybackSession = NodeSchemas['PlaybackSession']
export type PlaybackAction = NodeSchemas['ControlInputBody']['action']

export const fetchPlaybackFx = createNodeRequestFx<void, NodeSchemas['PlaybackOutputBody']>(() => ({
	url: '/v1/playback'
}))

export const startPlaybackFx = createNodeRequestFx<number, NodeSchemas['PlaybackOutputBody']>(fileId => ({
	url: '/v1/playback',
	method: 'POST',
	body: { file_id: fileId },

	// Starting mpv means waiting for a process and its socket.
	timeout: 20_000
}))

export interface ControlPlaybackParams {
	action: PlaybackAction
	position?: number
}

export const controlPlaybackFx = createNodeRequestFx<
	ControlPlaybackParams,
	NodeSchemas['PlaybackOutputBody']
>(({ action, position }) => ({
	url: '/v1/playback/command',
	method: 'POST',
	body: { action, position }
}))

export const stopPlaybackFx = createNodeRequestFx<void, NodeSchemas['PlaybackOutputBody']>(() => ({
	url: '/v1/playback',
	method: 'DELETE'
}))
