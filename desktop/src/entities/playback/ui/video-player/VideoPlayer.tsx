import clsx from 'clsx'
import { useUnit } from 'effector-react'
import Hls from 'hls.js'
import JASSUB from 'jassub'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, WindowControls } from '@shared/ui'
import type { DropdownMenuItem, IconName } from '@shared/ui'

import type { PlaybackStream } from '../api/api'
import { videoFit } from '../lib/fit'
import { initialAudio, initialSubtitle, trackLabel } from '../lib/tracks'
import { directUrl, fontUrl, mediaUrl, subtitleUrl } from '../lib/urls'
import { formatTimecode, playbackModel } from '../model/model'

import { usePlayerEntrance } from './usePlayerEntrance'
import styles from './VideoPlayer.module.scss'

const SEEK_STEP = 5
const VOLUME_STEP = 0.05
// Ten seconds without the pointer or a key, and the controls leave; they come back on
// the next movement. Playback itself does not count as activity.
const CONTROLS_HIDE_DELAY = 10_000
const PROGRESS_INTERVAL = 10_000
// Matches the keyframes in the stylesheet; the host waits this long before unmounting.
const LEAVE_MS = 240

// Chromium exposes audioTracks only behind a Blink feature, which the shell
// turns on; the DOM typings do not know about it.
interface AudioTrackList {
	length: number
	[index: number]: { enabled: boolean }
}

function audioTracksOf(video: HTMLVideoElement): AudioTrackList | undefined {
	return (video as HTMLVideoElement & { audioTracks?: AudioTrackList }).audioTracks
}

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
	const { t, i18n } = useTranslation()
	const [reportProgress, transcodeClosed] = useUnit([
		playbackModel.progressReported,
		playbackModel.transcodeClosed
	])

	const rootRef = useRef<HTMLDivElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)
	const [stageAspect, setStageAspect] = useState(0)
	const hlsRef = useRef<Hls | null>(null)
	const hlsPath = source.kind === 'hls' ? source.path : null

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
	const [fullscreen, setFullscreen] = useState(false)
	const [controlsVisible, setControlsVisible] = useState(true)
	const [activity, setActivity] = useState(0)
	const [failed, setFailed] = useState(false)

	// A full player that opens slides up from the bottom, like a drawer — carrying on
	// the slide the loading panel before it started, not starting one of its own.
	const entrance = usePlayerEntrance()
	const entering = entrance.entering && !mini

	const onLeftRef = useRef(onLeft)
	useEffect(() => {
		onLeftRef.current = onLeft
	})

	useEffect(() => {
		if (!leaving) {
			return
		}

		const timer = window.setTimeout(() => onLeftRef.current?.(), LEAVE_MS)

		return () => window.clearTimeout(timer)
	}, [leaving])

	const wake = useCallback(() => {
		setControlsVisible(true)
		setActivity(count => count + 1)
	}, [])

	useEffect(() => {
		const root = rootRef.current
		if (!root) {
			return
		}

		const measure = () => {
			const { width, height } = root.getBoundingClientRect()
			setStageAspect(height > 0 ? width / height : 0)
		}

		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(root)

		return () => observer.disconnect()
	}, [])

	const video = info.video ?? info.videos?.[0]
	const fit = video?.width && video.height ? videoFit(stageAspect, video.width / video.height) : 'contain'

	const [subtitle, setSubtitle] = useState<number | null>(() => initialSubtitle(subtitles))
	const [audio, setAudio] = useState(() => initialAudio(audios))

	const report = useCallback(
		(ended = false) => {
			const video = videoRef.current
			// A transcode's playlist grows while it is read, so the element's own
			// duration is only right once it ends; the probe knew it from the start.
			const total = info.duration > 0 ? info.duration : video?.duration
			if (!video || !total || !Number.isFinite(total)) {
				return
			}

			reportProgress({ fileId, position: video.currentTime, duration: total, ended })
		},
		[fileId, info.duration, reportProgress]
	)

	useEffect(() => {
		const video = videoRef.current
		if (!video || hlsPath === null) {
			return
		}

		const hls = new Hls()
		hlsRef.current = hls

		hls.on(Hls.Events.ERROR, (_, data) => {
			if (data.fatal) {
				console.warn('transcoded stream failed', data)
				setFailed(true)
			}
		})

		hls.loadSource(mediaUrl(hlsPath))
		hls.attachMedia(video)

		return () => {
			hls.destroy()
			hlsRef.current = null
			transcodeClosed(fileId)
		}
	}, [hlsPath, fileId, transcodeClosed])

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
	}, [fileId, subtitle, fonts])

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
	}, [audio, audios])

	useEffect(() => {
		if (!playing) {
			return
		}

		const timer = window.setInterval(() => report(), PROGRESS_INTERVAL)

		return () => window.clearInterval(timer)
	}, [playing, report])

	useEffect(() => () => report(), [report])

	useEffect(() => {
		const onChange = () => setFullscreen(document.fullscreenElement !== null)

		document.addEventListener('fullscreenchange', onChange)

		return () => {
			document.removeEventListener('fullscreenchange', onChange)
			if (document.fullscreenElement) {
				void document.exitFullscreen()
			}
		}
	}, [])

	const togglePlay = useCallback(() => {
		const video = videoRef.current
		if (!video) {
			return
		}

		if (video.paused) {
			void video.play()
		} else {
			video.pause()
		}
	}, [])

	const seekBy = useCallback((delta: number) => {
		const video = videoRef.current
		if (video) {
			video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || 0)
		}
	}, [])

	const changeVolume = useCallback((next: number) => {
		const video = videoRef.current
		if (video) {
			video.volume = Math.min(Math.max(next, 0), 1)
			video.muted = video.volume === 0
		}
	}, [])

	// The whole document goes fullscreen rather than the player: menus open in a
	// portal on <body>, and a fullscreen element hides everything outside it.
	const toggleFullscreen = useCallback(() => {
		if (document.fullscreenElement) {
			void document.exitFullscreen()
		} else {
			void document.documentElement.requestFullscreen()
		}
	}, [])

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			// The corner picture takes no keys: they belong to whatever page is open.
			if (
				mini ||
				event.target instanceof HTMLInputElement ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey
			) {
				return
			}

			wake()
			const video = videoRef.current

			switch (event.key) {
				case ' ':
				case 'k':
					togglePlay()
					break
				case 'ArrowLeft':
					seekBy(-SEEK_STEP)
					break
				case 'ArrowRight':
					seekBy(SEEK_STEP)
					break
				case 'ArrowUp':
					changeVolume((video?.volume ?? 1) + VOLUME_STEP)
					break
				case 'ArrowDown':
					changeVolume((video?.volume ?? 1) - VOLUME_STEP)
					break
				case 'm':
					if (video) video.muted = !video.muted
					break
				case 'f':
					toggleFullscreen()
					break
				case 'Escape':
					if (!document.fullscreenElement) onMinimize()
					break
				default:
					return
			}

			event.preventDefault()
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [mini, wake, togglePlay, seekBy, changeVolume, toggleFullscreen, onMinimize])

	// Keyed on activity, not on playback: the position changes several times a second
	// while the film plays, and restarting the timer on each of them would never let
	// the controls go.
	useEffect(() => {
		if (!controlsVisible || !playing) {
			return
		}

		const timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY)

		return () => window.clearTimeout(timer)
	}, [controlsVisible, playing, activity])

	const subtitleItems: DropdownMenuItem[] = [
		{
			id: 'off',
			label: t('player.subtitlesOff'),
			checked: subtitle === null,
			onSelect: () => setSubtitle(null)
		},
		...subtitles.map(track => ({
			id: `sub-${track.index}`,
			label: trackLabel(track, i18n.language),
			checked: subtitle === track.index,
			onSelect: () => setSubtitle(track.index)
		}))
	]

	const audioItems: DropdownMenuItem[] = audios.map(track => ({
		id: `audio-${track.index}`,
		label: trackLabel(track, i18n.language),
		checked: audio === track.index,
		onSelect: () => setAudio(track.index)
	}))

	const shown = controlsVisible || !playing || failed

	const progress = duration ? `${Math.min((position / duration) * 100, 100)}%` : '0%'

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
					onClick={togglePlay}
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

			<header className={clsx(styles.top, mini && styles.topMini, shown && styles.visible)}>
				{mini ? (
					<Button
						variant='chrome'
						iconOnly
						aria-label={t('player.expand')}
						startIcon={<Icon name='common/maximize' size={18} />}
						onClick={onExpand}
					/>
				) : (
					<Button
						variant='chrome'
						iconOnly
						aria-label={t('player.minimize')}
						startIcon={<Icon name='common/arrow-left' size={22} />}
						onClick={onMinimize}
					/>
				)}

				{!mini && (
					<div className={styles.heading}>
						<span className={styles.title}>{heading}</span>
						{subheading && <span className={styles.subtitle}>{subheading}</span>}
					</div>
				)}

				{mini && (
					<Button
						variant='chrome-close'
						iconOnly
						className={styles.controlEnd}
						aria-label={t('playback.stop')}
						startIcon={<Icon name='common/close' size={16} />}
						onClick={onClose}
					/>
				)}

				{!mini && !fullscreen && <WindowControls className={styles.window} />}
			</header>

			{failed && (
				<div className={styles.failure}>
					<p>{t('player.failed')}</p>
					<button type='button' className={styles.action} onClick={onOpenExternally}>
						{t('player.openExternally')}
					</button>
				</div>
			)}

			{mini ? (
				<div className={styles.miniProgress} style={{ width: progress }} />
			) : (
				<footer className={clsx(styles.bottom, shown && styles.visible)}>
					<input
						type='range'
						className={styles.seek}
						min={0}
						max={duration || 0}
						step={0.1}
						value={position}
						aria-label={t('player.seek')}
						style={
							{
								'--progress': duration ? `${(position / duration) * 100}%` : '0%'
							} as CSSProperties
						}
						onChange={event => {
							const video = videoRef.current
							if (video) video.currentTime = Number(event.target.value)
						}}
					/>

					<div className={styles.bar}>
						<ControlButton
							icon={playing ? 'common/pause' : 'common/play'}
							label={playing ? t('player.pause') : t('player.play')}
							onClick={togglePlay}
						/>

						<ControlButton
							icon={muted || volume === 0 ? 'common/volume-off' : 'common/volume'}
							label={muted ? t('player.unmute') : t('player.mute')}
							onClick={() => {
								const video = videoRef.current
								if (video) video.muted = !video.muted
							}}
						/>

						<input
							type='range'
							className={styles.volume}
							min={0}
							max={1}
							step={0.01}
							value={muted ? 0 : volume}
							aria-label={t('player.volume')}
							style={{ '--progress': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
							onChange={event => changeVolume(Number(event.target.value))}
						/>

						<span className={styles.time}>
							{formatTimecode(position)} / {formatTimecode(duration)}
						</span>

						<span className={styles.spacer} />

						{audios.length > 1 && (
							<DropdownMenu
								align='end'
								items={audioItems}
								trigger={
									<Button
										variant='chrome'
										iconOnly
										aria-label={t('player.audio')}
										startIcon={<Icon name='common/headphones' size={22} />}
									/>
								}
							/>
						)}

						{subtitles.length > 0 && (
							<DropdownMenu
								align='end'
								items={subtitleItems}
								trigger={
									<Button
										variant='chrome'
										iconOnly
										aria-label={t('player.subtitles')}
										startIcon={<Icon name='common/subtitles' size={22} />}
									/>
								}
							/>
						)}

						<ControlButton
							icon={fullscreen ? 'common/fullscreen-exit' : 'common/fullscreen'}
							label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
							onClick={toggleFullscreen}
						/>

						<ControlButton
							icon='common/close'
							label={t('playback.stop')}
							onClick={onClose}
							closing
						/>
					</div>
				</footer>
			)}
		</div>
	)
}

interface ControlButtonProps {
	icon: IconName
	label: string
	onClick: () => void
	closing?: boolean
}

function ControlButton({ icon, label, onClick, closing }: ControlButtonProps) {
	return (
		<Button
			variant={closing ? 'chrome-close' : 'chrome'}
			iconOnly
			aria-label={label}
			title={label}
			startIcon={<Icon name={icon} size={22} />}
			onClick={onClick}
		/>
	)
}
