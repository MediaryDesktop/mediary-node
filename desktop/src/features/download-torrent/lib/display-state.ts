import type { TorrentDownload } from '@entities/torrent'

export type TorrentDisplayState =
	| 'downloading'
	| 'paused'
	| 'stalled'
	| 'queued'
	| 'checking'
	| 'metadata'
	| 'error'
	| 'importing'
	| 'done'
	| 'failed'
	| 'unknown'

// What a row says about a download. Once the node has the files the node's own
// state is the story; before that, qBittorrent's dozen state names are folded into
// the few a person cares about.
export function displayState(download: TorrentDownload): TorrentDisplayState {
	if (download.state !== 'downloading') {
		return download.state
	}

	const live = download.live
	if (!live) {
		return 'unknown'
	}

	if (live.paused) {
		return 'paused'
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
