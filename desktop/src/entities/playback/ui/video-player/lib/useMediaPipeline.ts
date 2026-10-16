import { useUnit } from 'effector-react'
import Hls from 'hls.js'
import type { HlsConfig } from 'hls.js'
import JASSUB from 'jassub'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import type { MediaInfo } from '../../../api/api'
import { fontUrl, mediaUrl, subtitleUrl } from '../../../lib/urls'
import { playbackModel } from '../../../model/model'

type Track = NonNullable<MediaInfo['audios']>[number]
type Font = NonNullable<MediaInfo['fonts']>[number]

// Chromium exposes audioTracks only behind a Blink feature, which the shell
// turns on; the DOM typings do not know about it.
interface AudioTrackList {
	length: number
	[index: number]: { enabled: boolean }
}

function audioTracksOf(video: HTMLVideoElement): AudioTrackList | undefined {
	return (video as HTMLVideoElement & { audioTracks?: AudioTrackList }).audioTracks
}

// A segment the node answers with an error is one ffmpeg crashed on, and the
// node already tried it again: two more asks, not hls.js's six, before the
// player gives up and offers mpv. Slow segments still get hls.js's own timeouts.
const HLS_CONFIG: Partial<HlsConfig> = {
	fragLoadPolicy: {
		default: {
			maxTimeToFirstByteMs: 10000,
			maxLoadTimeMs: 120000,
			timeoutRetry: { maxNumRetry: 4, retryDelayMs: 0, maxRetryDelayMs: 0 },
			errorRetry: { maxNumRetry: 2, retryDelayMs: 1000, maxRetryDelayMs: 2000 }
		}
	}
}

export interface MediaPipelineOptions {
	videoRef: RefObject<HTMLVideoElement | null>
	fileId: number
	// The transcode's playlist, or null when the element plays the file directly.
	hlsPath: string | null
	subtitle: number | null
	fonts: Font[]
	audio: number
	audios: Track[]
	onFailed: () => void
}

// Everything that feeds the element besides its src: hls.js for a transcode, libass
// for subtitles and the chosen audio track.
export function useMediaPipeline({
	videoRef,
	fileId,
	hlsPath,
	subtitle,
	fonts,
	audio,
	audios,
	onFailed
}: MediaPipelineOptions): void {
	const transcodeClosed = useUnit(playbackModel.transcodeClosed)
	const hlsRef = useRef<Hls | null>(null)

	const onFailedRef = useRef(onFailed)
	useEffect(() => {
		onFailedRef.current = onFailed
	})

	useEffect(() => {
		const video = videoRef.current
		if (!video || hlsPath === null) {
			return
		}

		const hls = new Hls(HLS_CONFIG)
		hlsRef.current = hls

		hls.on(Hls.Events.ERROR, (_, data) => {
			if (data.fatal) {
				console.warn('transcoded stream failed', data)
				onFailedRef.current()
			}
		})

		hls.loadSource(mediaUrl(hlsPath))
		hls.attachMedia(video)

		return () => {
			hls.destroy()
			hlsRef.current = null
			transcodeClosed(fileId)
		}
	}, [videoRef, hlsPath, fileId, transcodeClosed])

	// Subtitles are drawn by libass in a worker; the instance is rebuilt per track
	// because a track switch also changes which fonts are worth loading.
	useEffect(() => {
		const video = videoRef.current
		if (!video || subtitle === null) {
			return
		}

		let instance: JASSUB | null = null

		try {
			instance = new JASSUB({
				video,
				subUrl: subtitleUrl(fileId, subtitle),
				fonts: fonts.map(font => fontUrl(fileId, font.index)),
				queryFonts: 'local'
			})
		} catch (error) {
			console.warn('subtitle renderer failed to start', error)
		}

		return () => {
			void instance?.destroy()
		}
	}, [videoRef, fileId, subtitle, fonts])

	useEffect(() => {
		const selected = audios.findIndex(track => track.index === audio)

		// The master playlist lists the tracks in the file's order.
		const hls = hlsRef.current
		if (hls) {
			if (selected >= 0 && hls.audioTrack !== selected) {
				hls.audioTrack = selected
			}
			return
		}

		const video = videoRef.current
		const tracks = video ? audioTracksOf(video) : undefined
		if (!video || !tracks || tracks.length < 2) {
			return
		}

		for (let i = 0; i < tracks.length; i += 1) {
			const track = tracks[i]
			if (track) track.enabled = i === selected
		}

		// Chromium keeps playing the old track's buffer until the next seek.
		const at = video.currentTime
		video.currentTime = at
	}, [videoRef, audio, audios])
}
