import { useUnit } from 'effector-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { problemDetail } from '@shared/api'
import type { HttpRequestError } from '@shared/api'
import type { PipIntent, PipOpenOptions } from '@shared/bridge'
import { useTranslation } from '@shared/i18n'
import { Button, ReelLoader } from '@shared/ui'

import { $nodeConnection, nodeBridgeMounted, subscribeToNodeState } from '@infra/node'

import {
	browserCanPlayType,
	canFallBack,
	chooseSource,
	fetchPlaybackStreamFx,
	VideoPlayer
} from '@entities/playback'
import type { PlaybackStream, PlayerSnapshot } from '@entities/playback'

import styles from './PipApp.module.scss'

// How often the main process is told where playback is, at most.
const REPORT_EVERY_MS = 500

/**
 * The page of the always-on-top window: nothing but the player, taking up where
 * the mini player left off. The window's frame is the player's own header.
 */
export function PipApp() {
	const { t } = useTranslation()

	const [options, setOptions] = useState<PipOpenOptions | null>(null)
	const [stream, setStream] = useState<PlaybackStream | null>(null)
	const [error, setError] = useState<HttpRequestError | null>(null)
	const [directFailed, setDirectFailed] = useState(false)

	const connection = useUnit($nodeConnection)

	const snapshot = useRef<PlayerSnapshot | null>(null)
	const lastReport = useRef(0)

	useEffect(() => {
		const unsubscribe = subscribeToNodeState()

		nodeBridgeMounted()
		void window.mediary.pip.params().then(setOptions)

		return unsubscribe
	}, [])

	const fileId = options?.fileId

	useEffect(() => {
		if (fileId === undefined || !connection) {
			return
		}

		let current = true

		fetchPlaybackStreamFx(fileId)
			.then(response => current && setStream(response.stream))
			.catch((failure: HttpRequestError) => current && setError(failure))

		return () => {
			current = false
		}
	}, [fileId, connection])

	const finish = useCallback((intent: PipIntent) => {
		void window.mediary.pip.finish(intent, snapshot.current)
	}, [])

	const onSnapshot = useCallback((next: PlayerSnapshot) => {
		snapshot.current = next

		const now = performance.now()

		if (now - lastReport.current >= REPORT_EVERY_MS) {
			lastReport.current = now
			window.mediary.pip.report(next)
		}
	}, [])

	if (error) {
		return (
			<div className={styles.message}>
				<p>{problemDetail(error, t('player.loadFailed'))}</p>
				<Button onClick={() => finish('expand')}>{t('player.expand')}</Button>
			</div>
		)
	}

	if (!options || !stream) {
		return (
			<div className={styles.message}>
				<ReelLoader spinning />
			</div>
		)
	}

	const source = chooseSource(stream, { directFailed, canPlayType: browserCanPlayType })

	if (!source) {
		return (
			<div className={styles.message}>
				<p>{t('player.needsTranscode')}</p>
				<Button onClick={() => finish('expand')}>{t('player.expand')}</Button>
			</div>
		)
	}

	return (
		<VideoPlayer
			key={`${stream.file_id}-${source.kind}`}
			stream={stream}
			source={source}
			heading={stream.title}
			subheading={
				stream.episode !== undefined ? t('playback.episode', { number: stream.episode }) : undefined
			}
			mode='pip'
			onMinimize={() => finish('mini')}
			onExpand={() => finish('expand')}
			onPin={() => finish('mini')}
			onClose={() => finish('stop')}
			onOpenExternally={() => finish('expand')}
			startAt={{ position: options.position, playing: options.playing }}
			onSnapshot={onSnapshot}
			onFallback={canFallBack(source, stream) ? () => setDirectFailed(true) : undefined}
		/>
	)
}
