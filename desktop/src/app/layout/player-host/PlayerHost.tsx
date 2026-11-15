import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, Icon, ReelLoader, WindowControls } from '@shared/ui'

import { useNodeData } from '@infra/node'
import { useWindowControls } from '@infra/window'

import {
	$playerExpanded,
	$playerFileId,
	$playerPinned,
	browserCanPlayType,
	canFallBack,
	chooseSource,
	playbackModel,
	playbackStreamQuery,
	playerClosed,
	playerExpanded,
	playerMinimized,
	playerPinned,
	playerUnpinned,
	usePlayerEntrance,
	VideoPlayer
} from '@entities/playback'
import type { PlayerSnapshot } from '@entities/playback'
import { isMissingToolError } from '@entities/tool'

import { $stream, $streamError, $streamTarget, streamCancelled } from '@features/stream-torrent'

import styles from './PlayerHost.module.scss'
import { PreparingStream } from './PreparingStream'

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
		minimize,
		expand,
		close,
		streamTarget,
		stream,
		streamError,
		cancelStream,
		pinned,
		pin,
		unpin
	] = useUnit([
		$playerFileId,
		$playerExpanded,
		playbackStreamQuery.$data,
		playbackStreamQuery.$error,
		playbackStreamQuery.$pending,
		playbackStreamQuery.start,
		playbackModel.playRequested,
		playerMinimized,
		playerExpanded,
		playerClosed,
		$streamTarget,
		$stream,
		$streamError,
		streamCancelled,
		$playerPinned,
		playerPinned,
		playerUnpinned
	])

	const [directFailedFor, setDirectFailedFor] = useState<number | null>(null)

	// Where playback stood when the pinned window gave the player back; the
	// player built again takes it up and clears it.
	const [resume, setResume] = useState<PlayerSnapshot | null>(null)

	useEffect(
		() =>
			window.mediary.pip.onClosed(result => {
				unpin()

				if (result.intent === 'stop') {
					close()
					cancelStream()

					return
				}

				setResume({ position: result.position, playing: result.playing })

				if (result.intent === 'expand') {
					expand()
				}
			}),
		[unpin, close, cancelStream, expand]
	)

	// Whatever ends the pinned state from this side — another video, the player
	// closed — takes the pinned window with it; when the window itself went,
	// there is nothing left to close.
	useEffect(() => {
		if (!pinned) {
			void window.mediary.pip.dismiss()
		}
	}, [pinned])

	const [leaving, setLeaving] = useState(false)

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

	useNodeData(playbackStreamQuery, { params: fileId ?? 0, enabled: fileId !== null })

	const navigate = useNavigate()

	const requestClose = () => setLeaving(true)

	const openDependencies = () => {
		requestClose()
		void navigate({ to: '/extensions', search: { tab: 'dependencies' } })
	}

	const finish = () => {
		setLeaving(false)
		setResume(null)
		close()
		cancelStream()
	}

	if (pinned) {
		return null
	}

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
					{isMissingToolError(error) ? (
						<Button variant='primary' onClick={openDependencies}>
							{t('player.openDependencies')}
						</Button>
					) : (
						<Button onClick={() => load(fileId)}>{t('media.retry')}</Button>
					)}
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

	const source = chooseSource(loadedStream, {
		directFailed: directFailedFor === fileId,
		canPlayType: browserCanPlayType
	})

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
			onPin={
				full
					? undefined
					: snapshot => {
							const video = loadedStream.info.video ?? loadedStream.info.videos?.[0]

							void window.mediary.pip
								.open({
									fileId,
									...snapshot,
									aspect: video?.width && video.height ? video.width / video.height : 16 / 9
								})
								.then(opened => opened && pin())
						}
			}
			startAt={resume}
			onStartApplied={() => setResume(null)}
			leaving={leaving}
			onClose={requestClose}
			onLeft={finish}
			onOpenExternally={openExternally}
			failureAction={failure =>
				isMissingToolError({ status: failure.status, body: { detail: failure.message } })
					? { label: t('player.openDependencies'), onClick: openDependencies }
					: undefined
			}
			onFallback={canFallBack(source, loadedStream) ? () => setDirectFailedFor(fileId) : undefined}
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
	const windowControls = useWindowControls()

	const { t } = useTranslation()

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
				<WindowControls {...windowControls} className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
