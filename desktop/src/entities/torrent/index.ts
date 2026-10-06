export {
	addTorrentMutation,
	checkTorrentClientMutation,
	pauseTorrentMutation,
	putTorrentSettingsMutation,
	removeTorrentMutation,
	resumeTorrentMutation,
	torrentDownloadsQuery,
	torrentSettingsQuery
} from './model/model'

export type {
	AddTorrentParams,
	RemoveTorrentParams,
	TorrentCheckParams,
	TorrentCheckResult,
	TorrentClientStatus,
	TorrentDownload,
	TorrentDownloads,
	TorrentPathMap,
	TorrentSettings,
	TorrentSettingsUpdate
} from './api/api'
