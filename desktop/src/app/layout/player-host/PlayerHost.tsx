import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, Icon, ReelLoader, WindowControls } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	$playerExpanded,
	$playerFileId,
	browserCanPlayType,
	canDirectPlay,
	playbackModel,
	playbackStreamQuery,
	playerClosed,
	playerExpanded,
	playerMinimized,
	usePlayerEntrance,
	VideoPlayer
} from '@entities/playback'
import type { VideoSource } from '@entities/playback'

import { $stream, $streamError, $streamTarget, streamCancelled } from '@features/stream-torrent'

import styles from './PlayerHost.module.scss'
import { PreparingStream } from './PreparingStream'

// The player lives at the root of the app and sits over the page behind it, so the
// page stays visible while the player slides in. Minimised, it is a corner card that
// stays put across route changes.
export function PlayerHost() {
	const { t } = useTranslation()

	const [
		fileId,
		full,
		data,
		error,
		pending,
		load,
		playExternally,
		nodeReady,
		minimize,
		expand,
		close,
		streamTarget,
		stream,
		streamError,
		cancelStream
	] = useUnit([
		$playerFileId,
		$playerExpanded,
		playbackStreamQuery.$data,
		playbackStreamQuery.$error,
		playbackStreamQuery.$pending,
		playbackStreamQuery.start,
		playbackModel.playRequested,
		$nodeReady,
		playerMinimized,
		playerExpanded,
		playerClosed,
		$streamTarget,
		$stream,
		$streamError,
		streamCancelled
	])

	// The file whose direct play failed; the transcode takes over for that file only.
	const [directFailedFor, setDirectFailedFor] = useState<number | null>(null)

	// Set while the player slides away; it is only unmounted once that has finished.
	const [leaving, setLeaving] = useState(false)

	// The page behind a full player must not draw its scrollbar over the picture.
	useEffect(() => {
		if (fileId === null && !streamTarget) {
			return
		}
		if (fileId !== null && !full) {
			return
		}

		const { style } = document.documentElement
		const previous = style.overflow
		style.overflow = 'hidden'

		return () => {
			style.overflow = previous
		}
	}, [full, fileId, streamTarget])

	useEffect(() => {
		if (fileId !== null && nodeReady) {
			load(fileId)
		}
	}, [fileId, load, nodeReady])

	const requestClose = () => setLeaving(true)

	// Closing covers both the built-in player, which may or may not be open, and a
	// stream still being readied: whichever applies, the other call is a no-op.
	const finish = () => {
		setLeaving(false)
		close()
		cancelStream()
	}

	// A stream opens the player the moment it is asked for, so there is something to
	// watch fill in rather than a wait with nothing to show for it, as Seanime does.
	if (fileId === null) {
		if (!streamTarget) {
			return null
		}

		return (
			<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
				<PreparingStream
					target={streamTarget}
					stream={stream}
					error={streamError}
					onStop={requestClose}
				/>
			</Panel>
		)
	}

	const openExternally = () => {
		playExternally(fileId)
		finish()
	}

	const loadedStream = data?.stream.file_id === fileId ? data.stream : null

	if (!loadedStream) {
		if (!full) {
			return null
		}

		if (error && !pending) {
			return (
				<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
					<p>{problemDetail(error, t('player.loadFailed'))}</p>
					<Button onClick={() => load(fileId)}>{t('media.retry')}</Button>
				</Panel>
			)
		}

		return (
			<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
				<ReelLoader spinning />
			</Panel>
		)
	}

	const subheading =
		loadedStream.episode !== undefined
			? t('playback.episode', { number: loadedStream.episode })
			: undefined

	const direct =
		directFailedFor !== fileId && canDirectPlay(loadedStream.info.mime_codec, browserCanPlayType)

	const source: VideoSource | null = direct
		? { kind: 'direct' }
		: loadedStream.hls_url
			? { kind: 'hls', path: loadedStream.hls_url }
			: null

	if (!source) {
		if (!full) {
			return null
		}

		return (
			<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
				<p className={styles.heading}>{loadedStream.title}</p>
				<p>{t('player.needsTranscode')}</p>
				<Button onClick={openExternally}>{t('player.openExternally')}</Button>
			</Panel>
		)
	}

	return (
		<VideoPlayer
			key={`${fileId}-${source.kind}`}
			stream={loadedStream}
			source={source}
			heading={loadedStream.title}
			subheading={subheading}
			mode={full ? 'full' : 'mini'}
			onMinimize={minimize}
			onExpand={expand}
			leaving={leaving}
			onClose={requestClose}
			onLeft={finish}
			onOpenExternally={openExternally}
			onFallback={
				source.kind === 'direct' && loadedStream.hls_url
					? () => setDirectFailedFor(fileId)
					: undefined
			}
		/>
	)
}

interface PanelProps {
	onClose: () => void
	leaving?: boolean
	onLeft?: () => void
	children: ReactNode
}

function Panel({ onClose, leaving, onLeft, children }: PanelProps) {
	const { t } = useTranslation()

	// The same slide-in and slide-out as the player's, so loading never shows a static
	// screen before the player arrives. The player then carries on this one slide
	// from wherever it has got to, rather than sliding up over it a second time.
	const entrance = usePlayerEntrance()

	const onLeftRef = useRef(onLeft)
	useEffect(() => {
		onLeftRef.current = onLeft
	})

	useEffect(() => {
		if (!leaving) {
			return
		}

		const timer = window.setTimeout(() => onLeftRef.current?.(), 240)

		return () => window.clearTimeout(timer)
	}, [leaving])

	return (
		<div
			className={clsx(styles.root, entrance.entering && styles.enter, leaving && styles.leave)}
			style={entrance.entering && !leaving ? entrance.style : undefined}
		>
			<header className={styles.top}>
				<Button
					variant='chrome'
					iconOnly
					aria-label={t('playback.stop')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>
				<WindowControls className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
