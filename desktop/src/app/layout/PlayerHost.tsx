import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

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
	VideoPlayer
} from '@entities/playback'
import type { VideoSource } from '@entities/playback'

import styles from './PlayerHost.module.scss'

// The player lives at the root of the app and sits over the page behind it, so the
// page stays visible while the player slides in. Minimised, it is a corner card that
// stays put across route changes.
export function PlayerHost() {
	const { t } = useTranslation()

	const [fileId, full, data, error, pending, load, playExternally, nodeReady, minimize, expand, close] =
		useUnit([
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
			playerClosed
		])

	// The file whose direct play failed; the transcode takes over for that file only.
	const [directFailedFor, setDirectFailedFor] = useState<number | null>(null)

	// Set while the player slides away; it is only unmounted once that has finished.
	const [leaving, setLeaving] = useState(false)

	// The page behind a full player must not draw its scrollbar over the picture.
	useEffect(() => {
		if (!full || fileId === null) {
			return
		}

		const { style } = document.documentElement
		const previous = style.overflow
		style.overflow = 'hidden'

		return () => {
			style.overflow = previous
		}
	}, [full, fileId])

	useEffect(() => {
		if (fileId !== null && nodeReady) {
			load(fileId)
		}
	}, [fileId, load, nodeReady])

	if (fileId === null) {
		return null
	}

	const requestClose = () => setLeaving(true)

	const finish = () => {
		setLeaving(false)
		close()
	}

	const openExternally = () => {
		playExternally(fileId)
		finish()
	}

	const stream = data?.stream.file_id === fileId ? data.stream : null

	if (!stream) {
		if (!full) {
			return null
		}

		if (error && !pending) {
			return (
				<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
					<p>{error.body?.detail ?? t('player.loadFailed')}</p>
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
		stream.episode !== undefined ? t('playback.episode', { number: stream.episode }) : undefined

	const direct = directFailedFor !== fileId && canDirectPlay(stream.info.mime_codec, browserCanPlayType)

	const source: VideoSource | null = direct
		? { kind: 'direct' }
		: stream.hls_url
			? { kind: 'hls', path: stream.hls_url }
			: null

	if (!source) {
		if (!full) {
			return null
		}

		return (
			<Panel onClose={requestClose} leaving={leaving} onLeft={finish}>
				<p className={styles.heading}>{stream.title}</p>
				<p>{t('player.needsTranscode')}</p>
				<Button onClick={openExternally}>{t('player.openExternally')}</Button>
			</Panel>
		)
	}

	return (
		<VideoPlayer
			key={`${fileId}-${source.kind}`}
			stream={stream}
			source={source}
			heading={stream.title}
			subheading={subheading}
			mode={full ? 'full' : 'mini'}
			onMinimize={minimize}
			onExpand={expand}
			leaving={leaving}
			onClose={requestClose}
			onLeft={finish}
			onOpenExternally={openExternally}
			onFallback={
				source.kind === 'direct' && stream.hls_url ? () => setDirectFailedFor(fileId) : undefined
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

	// Its own slide-in and slide-out, the same as the player's, so loading never shows
	// a static screen before the player arrives.
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
		<div className={`${styles.root} ${styles.enter} ${leaving ? styles.leave : ''}`}>
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
