import { useUnit } from 'effector-react'
import Hls from 'hls.js'
import type { ErrorData, HlsConfig } from 'hls.js'
import JASSUB from 'jassub'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import type { MediaInfo } from '../../../api/api'
import { fontUrl, mediaUrl, subtitleUrl } from '../../../lib/urls'
import { playbackModel } from '../../../model/model'

type Track = NonNullable<MediaInfo['audios']>[number]
type Font = NonNullable<MediaInfo['fonts']>[number]

interface AudioTrackList {
	length: number
	[index: number]: { enabled: boolean }
}

function audioTracksOf(video: HTMLVideoElement): AudioTrackList | undefined {
	return (video as HTMLVideoElement & { audioTracks?: AudioTrackList }).audioTracks
}

const HLS_CONFIG: Partial<HlsConfig> = {
	backBufferLength: 90,
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
	hlsPath: string | null
	subtitle: number | null
	fonts: Font[]
	audio: number
	audios: Track[]
	onFailed: (failure: PlayerFailure) => void
}

export interface PlayerFailure {
	status?: number
	message?: string
}

function failureOf(data: ErrorData): PlayerFailure {
	const status = data.response?.code || undefined
	const details = data.networkDetails as { responseText?: unknown } | undefined

	let message: string | undefined
	if (typeof details?.responseText === 'string') {
		try {
			const body = JSON.parse(details.responseText) as { detail?: unknown }
			message = typeof body.detail === 'string' ? body.detail : undefined
		} catch {
			message = undefined
		}
	}

	return { status, message }
}

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
				onFailedRef.current(failureOf(data))
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

		const at = video.currentTime
		video.currentTime = at
	}, [videoRef, audio, audios])
}
