import clsx from 'clsx'
import { useMemo, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useAfterDelay } from '@shared/lib'

import type { PlaybackStream } from '../../api/api'
import { initialAudio, initialSubtitle } from '../../lib/tracks'
import { directUrl } from '../../lib/urls'

import { useFullscreen } from './lib/useFullscreen'
import { useIdleControls } from './lib/useIdleControls'
import { useMediaPipeline } from './lib/useMediaPipeline'
import { usePlayerEntrance } from './lib/usePlayerEntrance'
import { usePlayerKeyboard } from './lib/usePlayerKeyboard'
import { useProgressReport } from './lib/useProgressReport'
import { useStageFit } from './lib/useStageFit'
import { useVideoActions } from './lib/useVideoActions'
import { PlayerControls } from './player-controls/PlayerControls'
import { TrackMenus } from './player-controls/track-menus/TrackMenus'
import { PlayerHeader } from './player-header/PlayerHeader'
import styles from './VideoPlayer.module.scss'

// Matches the keyframes in the stylesheet; the host waits this long before unmounting.
const LEAVE_MS = 240

// Direct play hands the file to the video element as it is; HLS goes through
// hls.js, because Chromium has no HLS of its own.
export type VideoSource = { kind: 'direct' } | { kind: 'hls'; path: string }

export interface VideoPlayerProps {
	stream: PlaybackStream
	source: VideoSource
	heading: string
	subheading?: string
	// Full covers the window; mini is the corner picture that stays while the user
	// browses. The same element plays in both, so switching does not interrupt it.
	mode: 'full' | 'mini'
	onMinimize: () => void
	onExpand: () => void
	onClose: () => void
	onOpenExternally: () => void

	// Called instead of showing a failure when there is somewhere else to go:
	// a file Chromium said it could play directly and then could not.
	onFallback?: () => void

	// Set while the player slides away; onLeft runs once that has finished.
	leaving?: boolean
	onLeft?: () => void
}

export function VideoPlayer({
	stream,
	source,
	heading,
	subheading,
	mode,
	onMinimize,
	onExpand,
	onClose,
	onOpenExternally,
	onFallback,
	leaving = false,
	onLeft
}: VideoPlayerProps) {
	const mini = mode === 'mini'
	const { t } = useTranslation()

	const rootRef = useRef<HTMLDivElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)

	const fileId = stream.file_id
	const info = stream.info

	// The node never sends these empty-handed, but the schema allows null.
	const audios = useMemo(() => info.audios ?? [], [info.audios])
	const subtitles = useMemo(() => info.subtitles ?? [], [info.subtitles])
	const fonts = useMemo(() => info.fonts ?? [], [info.fonts])

	const [playing, setPlaying] = useState(false)
	const [position, setPosition] = useState(0)
	const [duration, setDuration] = useState(info.duration)
	const [volume, setVolume] = useState(1)
	const [muted, setMuted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [subtitle, setSubtitle] = useState<number | null>(() => initialSubtitle(subtitles))
	const [audio, setAudio] = useState(() => initialAudio(audios))

	// A full player that opens slides up from the bottom, like a drawer — carrying on
	// the slide the loading panel before it started, not starting one of its own.
	const entrance = usePlayerEntrance()
	const entering = entrance.entering && !mini

	useAfterDelay(leaving, LEAVE_MS, () => onLeft?.())

	const video = info.video ?? info.videos?.[0]
	const fit = useStageFit(rootRef, video?.width && video.height ? video.width / video.height : null)

	useMediaPipeline({
		videoRef,
		fileId,
		hlsPath: source.kind === 'hls' ? source.path : null,
		subtitle,
		fonts,
		audio,
		audios,
		onFailed: () => setFailed(true)
	})

	const report = useProgressReport({ videoRef, fileId, probedDuration: info.duration, playing })
	const actions = useVideoActions(videoRef, setPosition)
	const { fullscreen, toggleFullscreen } = useFullscreen()
	const { controlsVisible, wake } = useIdleControls(playing)

	usePlayerKeyboard({
		enabled: !mini,
		videoRef,
		actions,
		onActivity: wake,
		onToggleFullscreen: toggleFullscreen,
		onMinimize
	})

	const shown = controlsVisible || !playing || failed

	return (
		<div
			ref={rootRef}
			className={clsx(
				styles.root,
				mini ? styles.mini : styles.full,
				entering && styles.enter,
				leaving && styles.leave,
				!shown && styles.idle
			)}
			style={entering && !leaving ? entrance.style : undefined}
			onMouseMove={wake}
		>
			<div className={styles.stage}>
				<video
					ref={videoRef}
					className={styles.video}
					style={{ objectFit: fit }}
					src={source.kind === 'direct' ? directUrl(fileId) : undefined}
					// The node is another origin; without CORS the frames are tainted
					// and the subtitle renderer cannot read them.
					crossOrigin='anonymous'
					autoPlay
					onClick={actions.togglePlay}
					onDoubleClick={() => (mini ? onExpand() : toggleFullscreen())}
					onPlay={() => setPlaying(true)}
					onPause={() => {
						setPlaying(false)
						report()
					}}
					onEnded={() => report(true)}
					onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
					onDurationChange={event => {
						const value = event.currentTarget.duration
						if (info.duration <= 0 && Number.isFinite(value)) setDuration(value)
					}}
					onVolumeChange={event => {
						setVolume(event.currentTarget.volume)
						setMuted(event.currentTarget.muted)
					}}
					onError={() => {
						if (onFallback) {
							onFallback()
						} else {
							setFailed(true)
						}
					}}
				/>
			</div>

			<PlayerHeader
				mini={mini}
				visible={shown}
				fullscreen={fullscreen}
				heading={heading}
				subheading={subheading}
				onMinimize={onMinimize}
				onExpand={onExpand}
				onClose={onClose}
			/>

			{failed && (
				<div className={styles.failure}>
					<p>{t('player.failed')}</p>
					<button type='button' className={styles.action} onClick={onOpenExternally}>
						{t('player.openExternally')}
					</button>
				</div>
			)}

			{mini ? (
				<div
					className={styles.miniProgress}
					style={{ width: duration ? `${Math.min((position / duration) * 100, 100)}%` : '0%' }}
				/>
			) : (
				<PlayerControls
					visible={shown}
					playing={playing}
					position={position}
					duration={duration}
					volume={volume}
					muted={muted}
					fullscreen={fullscreen}
					actions={actions}
					onToggleFullscreen={toggleFullscreen}
					onClose={onClose}
				>
					<TrackMenus
						audios={audios}
						audio={audio}
						onAudio={setAudio}
						subtitles={subtitles}
						subtitle={subtitle}
						onSubtitle={setSubtitle}
					/>
				</PlayerControls>
			)}
		</div>
	)
}
