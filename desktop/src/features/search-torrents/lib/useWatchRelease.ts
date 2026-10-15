import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { toast } from '@shared/ui'

import { $playerMode, playbackModel, playerOpened } from '@entities/playback'
import { fetchTorrentStreamFx, startTorrentStreamFx } from '@entities/torrent'
import type { TorrentRelease, TorrentStream } from '@entities/torrent'

// How often a stream the service is still getting is asked about.
const POLL_MS = 2000

export interface StreamEpisode {
	episode?: number
	season?: number
}

// Which episode a release plays: its own when it holds one, the one searched
// for when it is a batch. A batch with no episode searched has nothing to pick
// by, so it cannot be watched; a release without episodes is a film or the like,
// and the node plays its largest video.
export function streamEpisode(
	release: TorrentRelease,
	searched: { episode: string; season: string }
): StreamEpisode | null {
	const range = release.episodes
	const wanted = Number(searched.episode) || undefined
	const season = release.season ?? (Number(searched.season) || undefined)

	if (!range) {
		return { season }
	}
	if (range.from === range.to) {
		return { episode: range.from, season }
	}
	if (wanted !== undefined && wanted >= range.from && wanted <= range.to) {
		return { episode: wanted, season }
	}

	return null
}

export interface WatchReleaseOptions {
	mediaRef: string
	title: string
	// Called once the player is open, so the search can close behind it.
	onPlaying: () => void
}

export interface WatchRelease {
	// The release being readied, and how far the service is with it.
	releaseId: string | null
	stream: TorrentStream | null
	watch: (release: TorrentRelease, episode: StreamEpisode) => void
	cancel: () => void
}

// Plays a release without downloading it: the node gives it to the debrid
// service, and once the service holds the file the player opens on it, the
// built-in one or mpv as the settings say.
export function useWatchRelease({ mediaRef, title, onPlaying }: WatchReleaseOptions): WatchRelease {
	const { t } = useTranslation()
	const [mode, playExternally, openPlayer] = useUnit([
		$playerMode,
		playbackModel.playRequested,
		playerOpened
	])

	const [releaseId, setReleaseId] = useState<string | null>(null)
	// The release an answer has to be about to count; a cancelled one is not.
	const activeRef = useRef<string | null>(null)
	const [stream, setStream] = useState<TorrentStream | null>(null)

	const fail = (forRelease: string, message: string) => {
		if (activeRef.current !== forRelease) {
			return
		}
		activeRef.current = null
		toast.error(message, { id: 'torrent-stream' })
		setReleaseId(null)
		setStream(null)
	}

	const settle = (forRelease: string, next: TorrentStream) => {
		if (activeRef.current !== forRelease) {
			return
		}
		if (next.state === 'failed') {
			fail(forRelease, next.error || t('torrents.stream.failed'))
			return
		}

		if (next.state === 'ready' && next.file_id) {
			activeRef.current = null
			setReleaseId(null)
			setStream(null)

			if (mode === 'external') {
				playExternally(next.file_id)
			} else {
				openPlayer(next.file_id)
			}
			onPlaying()
			return
		}

		setStream(next)
	}

	useEffect(() => {
		if (!stream || (stream.state !== 'preparing' && stream.state !== 'queued')) {
			return
		}

		const forRelease = activeRef.current ?? ''
		const timer = window.setTimeout(() => {
			fetchTorrentStreamFx(stream.id)
				.then(next => settle(forRelease, next))
				.catch(error => fail(forRelease, problemDetail(error, t('torrents.stream.failed'))))
		}, POLL_MS)

		return () => window.clearTimeout(timer)
		// settle and fail check the active release through the ref; polling only
		// follows the stream itself.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stream])

	const watch = (release: TorrentRelease, episode: StreamEpisode) => {
		activeRef.current = release.id
		setReleaseId(release.id)
		setStream(null)

		startTorrentStreamFx({
			media_ref: mediaRef,
			title,
			release_id: release.id,
			episode: episode.episode,
			season: episode.season
		})
			.then(next => settle(release.id, next))
			.catch(error => fail(release.id, problemDetail(error, t('torrents.stream.failed'))))
	}

	const cancel = () => {
		activeRef.current = null
		setReleaseId(null)
		setStream(null)
	}

	return { releaseId, stream, watch, cancel }
}
