import { createNodeRequestFx } from '@infra/node'
import type { NodeSchemas } from '@infra/node'

export type TorrentDownload = NodeSchemas['TorrentDownload']
export type TorrentDownloads = NodeSchemas['TorrentDownloadsOutputBody']
export type TorrentClientStatus = NodeSchemas['TorrentClientStatus']
export type TorrentSettings = NodeSchemas['TorrentSettings']
export type TorrentPathMap = NodeSchemas['TorrentPathMap']
export type TorrentCheckResult = NodeSchemas['TorrentCheckResult']

export type AddTorrentParams = Omit<NodeSchemas['AddTorrentDownloadInputBody'], '$schema'>
export type TorrentSettingsUpdate = Omit<NodeSchemas['PutTorrentSettingsInputBody'], '$schema'>
export type TorrentCheckParams = Omit<NodeSchemas['CheckTorrentClientInputBody'], '$schema'>

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
