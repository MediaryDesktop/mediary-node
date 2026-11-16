import { useUnit } from 'effector-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { problemDetail } from '@shared/api'
import type { PipIntent, PipOpenOptions } from '@shared/bridge'
import { useTranslation } from '@shared/i18n'
import { Button, ReelLoader } from '@shared/ui'

import { nodeBridgeMounted, subscribeToNodeState, useNodeData } from '@infra/node'

import {
	browserCanPlayType,
	canFallBack,
	chooseSource,
	playbackStreamQuery,
	VideoPlayer
} from '@entities/playback'
import type { PlayerSnapshot } from '@entities/playback'

import styles from './PipApp.module.scss'

const REPORT_EVERY_MS = 500

export function PipApp() {
	const { t } = useTranslation()

	const [options, setOptions] = useState<PipOpenOptions | null>(null)
	const [directFailed, setDirectFailed] = useState(false)

	const [data, error] = useUnit([playbackStreamQuery.$data, playbackStreamQuery.$error])

	const snapshot = useRef<PlayerSnapshot | null>(null)
	const lastReport = useRef(0)

	useEffect(() => {
		const unsubscribe = subscribeToNodeState()

		nodeBridgeMounted()
		void window.mediary.pip.params().then(setOptions)

		return unsubscribe
	}, [])

	const fileId = options?.fileId

	useNodeData(playbackStreamQuery, { params: fileId ?? 0, enabled: fileId !== undefined })

	const stream = data && data.stream.file_id === fileId ? data.stream : null

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
		<Suspense
			fallback={
				<div className={styles.message}>
					<ReelLoader spinning />
				</div>
			}
		>
			<VideoPlayer
				key={`${stream.file_id}-${source.kind}`}
				stream={stream}
				source={source}
				heading={stream.title}
				subheading={
					stream.episode !== undefined
						? t('playback.episode', { number: stream.episode })
						: undefined
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
		</Suspense>
	)
}
