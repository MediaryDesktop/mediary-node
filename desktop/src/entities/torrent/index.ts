export {
	addTorrentMutation,
	checkTorrentClientMutation,
	checkTorrentRuleMutation,
	checkTorrentSourceMutation,
	createTorrentSourceMutation,
	deleteTorrentRuleMutation,
	deleteTorrentSourceMutation,
	pauseTorrentMutation,
	putTorrentProfileMutation,
	putTorrentRuleMutation,
	putTorrentSettingsMutation,
	removeTorrentMutation,
	resumeTorrentMutation,
	selectTorrentFilesMutation,
	torrentDownloadsQuery,
	torrentFilesClosed,
	torrentFilesOpened,
	torrentFilesQuery,
	torrentProfileQuery,
	torrentRuleQuery,
	torrentRulesQuery,
	torrentSearchQuery,
	torrentSettingsQuery,
	torrentSourcesQuery,
	updateTorrentSourceMutation
} from './model/model'

// The add effect itself, for a model that adds several releases one after another.
export { addTorrentFx } from './api/api'

// Playing a torrent without downloading it: start, then ask until it is ready.
export { fetchTorrentStreamFx, startTorrentStreamFx } from './api/api'
export type { StartTorrentStreamParams, TorrentStream } from './api/api'

export { useTorrentSetup } from './lib/useTorrentSetup'
export { DEBRID_SERVICES, debridService, isDebrid } from './lib/clients'
export type { DebridKind, DebridService, TorrentClientKind } from './lib/clients'
export { TorrentSetupNotice } from './ui/torrent-setup-notice/TorrentSetupNotice'
export type { TorrentSetupNoticeProps } from './ui/torrent-setup-notice/TorrentSetupNotice'
export type { TorrentSetup } from './lib/useTorrentSetup'

export type {
	AddTorrentParams,
	RemoveTorrentParams,
	SelectTorrentFilesParams,
	TorrentCheckParams,
	TorrentCheckResult,
	TorrentClientStatus,
	TorrentDownload,
	TorrentDownloads,
	TorrentFile,
	TorrentPathMap,
	TorrentProfile,
	TorrentRule,
	TorrentRuleBody,
	TorrentRuleCheck,
	TorrentRelease,
	TorrentSearchParams,
	TorrentSearchResult,
	TorrentSettings,
	TorrentSettingsUpdate,
	TorrentSource,
	TorrentSourceBody,
	TorrentSourceCaps,
	TorrentSourceCheckParams,
	UpdateTorrentSourceParams
} from './api/api'
