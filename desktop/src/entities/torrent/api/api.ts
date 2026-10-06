import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type TorrentDownload = NodeSchemas['TorrentDownload']
export type TorrentDownloads = NodeSchemas['TorrentDownloadsOutputBody']
export type TorrentClientStatus = NodeSchemas['TorrentClientStatus']
export type TorrentSettings = NodeSchemas['TorrentSettings']
export type TorrentPathMap = NodeSchemas['TorrentPathMap']
export type TorrentCheckResult = NodeSchemas['TorrentCheckResult']
export type TorrentFile = NodeSchemas['TorrentFile']
export type TorrentSource = NodeSchemas['TorrentSource']
export type TorrentProfile = Omit<NodeSchemas['TorrentProfile'], '$schema'>
export type TorrentSourceCaps = NodeSchemas['TorrentSourceCaps']
export type TorrentRelease = NodeSchemas['TorrentRelease']
export type TorrentSearchResult = NodeSchemas['TorrentSearchResult']
export type TorrentSourceBody = Omit<NodeSchemas['TorrentSourceBody'], '$schema'>
export type TorrentSourceCheckParams = Omit<NodeSchemas['CheckTorrentSourceInputBody'], '$schema'>

export interface UpdateTorrentSourceParams {
	id: number
	body: TorrentSourceBody
}

export interface TorrentSearchParams {
	mediaRef: string
	// 0 for any episode.
	episode: number
	// Replaces the title's names when not empty.
	query: string
}

export type AddTorrentParams = Omit<NodeSchemas['AddTorrentDownloadInputBody'], '$schema'>
export type TorrentSettingsUpdate = Omit<NodeSchemas['PutTorrentSettingsInputBody'], '$schema'>
export type TorrentCheckParams = Omit<NodeSchemas['CheckTorrentClientInputBody'], '$schema'>

export interface SelectTorrentFilesParams {
	id: number
	selected: number[]
}

export interface RemoveTorrentParams {
	id: number
	withFiles: boolean
}

export const fetchTorrentDownloadsFx = createNodeRequestFx<void, TorrentDownloads>(() => ({
	url: '/v1/torrent/downloads'
}))

export const addTorrentFx = createNodeRequestFx<AddTorrentParams, TorrentDownload>(body => ({
	url: '/v1/torrent/downloads',
	method: 'POST',
	body,
	// The node waits for qBittorrent, which has its own 15 s to answer.
	timeout: 20_000
}))

export const pauseTorrentFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/torrent/downloads/${id}/pause`,
	method: 'POST'
}))

export const resumeTorrentFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/torrent/downloads/${id}/resume`,
	method: 'POST'
}))

export const removeTorrentFx = createNodeRequestFx<RemoveTorrentParams, void>(({ id, withFiles }) => ({
	url: `/v1/torrent/downloads/${id}`,
	method: 'DELETE',
	query: { with_files: withFiles }
}))

export const fetchTorrentFilesFx = createNodeRequestFx<number, NodeSchemas['TorrentFilesOutputBody']>(id => ({
	url: `/v1/torrent/downloads/${id}/files`,
	// The node asks qBittorrent for the list.
	timeout: 20_000
}))

export const selectTorrentFilesFx = createNodeRequestFx<SelectTorrentFilesParams, void>(
	({ id, selected }) => ({
		url: `/v1/torrent/downloads/${id}/files`,
		method: 'PUT',
		body: { selected },
		timeout: 20_000
	})
)

export const fetchTorrentSettingsFx = createNodeRequestFx<void, TorrentSettings>(() => ({
	url: '/v1/torrent/settings'
}))

export const putTorrentSettingsFx = createNodeRequestFx<TorrentSettingsUpdate, TorrentSettings>(body => ({
	url: '/v1/torrent/settings',
	method: 'PUT',
	body
}))

export const checkTorrentClientFx = createNodeRequestFx<TorrentCheckParams, TorrentCheckResult>(body => ({
	url: '/v1/torrent/check',
	method: 'POST',
	body,
	timeout: 20_000
}))

export const fetchTorrentSourcesFx = createNodeRequestFx<void, NodeSchemas['TorrentSourcesOutputBody']>(
	() => ({
		url: '/v1/torrent/sources'
	})
)

export const createTorrentSourceFx = createNodeRequestFx<TorrentSourceBody, TorrentSource>(body => ({
	url: '/v1/torrent/sources',
	method: 'POST',
	body
}))

export const updateTorrentSourceFx = createNodeRequestFx<UpdateTorrentSourceParams, TorrentSource>(
	({ id, body }) => ({
		url: `/v1/torrent/sources/${id}`,
		method: 'PUT',
		body
	})
)

export const deleteTorrentSourceFx = createNodeRequestFx<number, void>(id => ({
	url: `/v1/torrent/sources/${id}`,
	method: 'DELETE'
}))

export const checkTorrentSourceFx = createNodeRequestFx<TorrentSourceCheckParams, TorrentSourceCaps>(
	body => ({
		url: '/v1/torrent/sources/check',
		method: 'POST',
		body,
		timeout: 25_000
	})
)

export const searchTorrentsFx = createNodeRequestFx<TorrentSearchParams, TorrentSearchResult>(
	({ mediaRef, episode, query }) => ({
		url: '/v1/torrent/search',
		query: { media_ref: mediaRef, episode: episode || undefined, q: query.trim() || undefined },
		// The node waits for the slowest source, up to 25 s.
		timeout: 30_000
	})
)

export const fetchTorrentProfileFx = createNodeRequestFx<void, TorrentProfile>(() => ({
	url: '/v1/torrent/profile'
}))

export const putTorrentProfileFx = createNodeRequestFx<TorrentProfile, TorrentProfile>(body => ({
	url: '/v1/torrent/profile',
	method: 'PUT',
	body
}))
