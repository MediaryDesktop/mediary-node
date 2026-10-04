import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, ReelLoader, WindowControls } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	browserCanPlayType,
	canDirectPlay,
	playbackModel,
	playbackStreamQuery,
	VideoPlayer
} from '@entities/playback'
import type { VideoSource } from '@entities/playback'

import styles from './WatchPage.module.scss'

export interface WatchPageProps {
	fileId: number
}

export function WatchPage({ fileId }: WatchPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const [data, error, pending, load, playExternally, nodeReady] = useUnit([
		playbackStreamQuery.$data,
		playbackStreamQuery.$error,
		playbackStreamQuery.$pending,
		playbackStreamQuery.start,
		playbackModel.playRequested,
		$nodeReady
	])

	// Set when direct play was attempted and failed; the transcode takes over.
	const [directFailed, setDirectFailed] = useState(false)

	useEffect(() => {
		if (nodeReady) {
			load(fileId)
		}
	}, [fileId, load, nodeReady])

	const close = () => router.history.back()

	const openExternally = () => {
		playExternally(fileId)
		close()
	}

	const stream = data?.stream.file_id === fileId ? data.stream : null

	if (!stream) {
		if (error && !pending) {
			return (
				<Panel onClose={close}>
					<p>{error.body?.detail ?? t('player.loadFailed')}</p>
					<Button onClick={() => load(fileId)}>{t('media.retry')}</Button>
				</Panel>
			)
		}

		return (
			<Panel onClose={close}>
				<ReelLoader spinning />
			</Panel>
		)
	}

	const subheading =
		stream.episode !== undefined ? t('playback.episode', { number: stream.episode }) : undefined

	const direct = !directFailed && canDirectPlay(stream.info.mime_codec, browserCanPlayType)

	const source: VideoSource | null = direct
		? { kind: 'direct' }
		: stream.hls_url
			? { kind: 'hls', path: stream.hls_url }
			: null

	if (!source) {
		return (
			<Panel onClose={close}>
				<p className={styles.heading}>{stream.title}</p>
				<p>{t('player.needsTranscode')}</p>
				<Button onClick={openExternally}>{t('player.openExternally')}</Button>
			</Panel>
		)
	}

	return (
		<VideoPlayer
			key={source.kind}
			stream={stream}
			source={source}
			heading={stream.title}
			subheading={subheading}
			onClose={close}
			onOpenExternally={openExternally}
			onFallback={source.kind === 'direct' && stream.hls_url ? () => setDirectFailed(true) : undefined}
		/>
	)
}

interface PanelProps {
	onClose: () => void
	children: ReactNode
}

function Panel({ onClose, children }: PanelProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<header className={styles.top}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('player.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>
				<WindowControls className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
