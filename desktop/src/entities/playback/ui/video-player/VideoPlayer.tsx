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
import type { PlayerFailure } from './lib/useMediaPipeline'
import { usePlayerEntrance } from './lib/usePlayerEntrance'
import { usePlayerKeyboard } from './lib/usePlayerKeyboard'
import { useProgressReport } from './lib/useProgressReport'
import { useStageFit } from './lib/useStageFit'
import { useVideoActions } from './lib/useVideoActions'
import { PlayerControls } from './player-controls/PlayerControls'
import { TrackMenus } from './player-controls/track-menus/TrackMenus'
import { PlayerHeader } from './player-header/PlayerHeader'
import styles from './VideoPlayer.module.scss'

const LEAVE_MS = 240

export type VideoSource = { kind: 'direct' } | { kind: 'hls'; path: string }

export interface VideoPlayerProps {
	stream: PlaybackStream
	source: VideoSource
	heading: string
	subheading?: string
	mode: 'full' | 'mini'
	onMinimize: () => void
	onExpand: () => void
	onClose: () => void
	onOpenExternally: () => void
	failureAction?: (failure: PlayerFailure) => { label: string; onClick: () => void } | undefined

	onFallback?: () => void

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
	failureAction,
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

	const audios = useMemo(() => info.audios ?? [], [info.audios])
	const subtitles = useMemo(() => info.subtitles ?? [], [info.subtitles])
	const fonts = useMemo(() => info.fonts ?? [], [info.fonts])

	const [playing, setPlaying] = useState(false)
	const [position, setPosition] = useState(0)
	const [duration, setDuration] = useState(info.duration)
	const [volume, setVolume] = useState(1)
	const [muted, setMuted] = useState(false)
	const [failure, setFailure] = useState<PlayerFailure | null>(null)
	const failed = failure !== null
	const [subtitle, setSubtitle] = useState<number | null>(() => initialSubtitle(subtitles))
	const [audio, setAudio] = useState(() => initialAudio(audios))

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
		onFailed: setFailure
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
	const extraAction = failure ? failureAction?.(failure) : undefined

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
							setFailure({})
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

			{failure && (
				<div className={styles.failure}>
					<p>{failure.message ?? t('player.failed')}</p>
					<div className={styles.failureActions}>
						{extraAction && (
							<button type='button' className={styles.action} onClick={extraAction.onClick}>
								{extraAction.label}
							</button>
						)}
						<button type='button' className={styles.action} onClick={onOpenExternally}>
							{t('player.openExternally')}
						</button>
					</div>
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
