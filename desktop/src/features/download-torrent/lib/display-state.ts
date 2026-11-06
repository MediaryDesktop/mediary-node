import type { TorrentDownload } from '@entities/torrent'

export type TorrentDisplayState =
	| 'choosing'
	| 'downloading'
	| 'paused'
	| 'stalled'
	| 'queued'
	| 'remote'
	| 'remoteQueued'
	| 'checking'
	| 'metadata'
	| 'error'
	| 'importing'
	| 'done'
	| 'failed'
	| 'unknown'

export function displayState(download: TorrentDownload): TorrentDisplayState {
	if (download.state !== 'downloading') {
		return download.state
	}

	if (download.choosing) {
		return 'choosing'
	}

	const live = download.live
	if (!live) {
		return 'unknown'
	}

	if (live.paused) {
		return 'paused'
	}

	if (live.remote) {
		return live.remote.queued ? 'remoteQueued' : 'remote'
	}

	const state = live.state

	if (state === 'error' || state === 'missingFiles') {
		return 'error'
	}
	if (state === 'metaDL' || state === 'forcedMetaDL') {
		return 'metadata'
	}
	if (state.startsWith('checking') || state === 'moving' || state === 'allocating') {
		return 'checking'
	}
	if (state.startsWith('queued')) {
		return 'queued'
	}
	if (state.startsWith('stalled')) {
		return 'stalled'
	}

	return 'downloading'
}
