import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, ReelLoader, WindowControls } from '@shared/ui'

import {
	browserCanPlayType,
	canDirectPlay,
	playbackModel,
	playbackStreamQuery,
	VideoPlayer
} from '@entities/playback'

import styles from './WatchPage.module.scss'

export interface WatchPageProps {
	fileId: number
}

export function WatchPage({ fileId }: WatchPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const [data, error, pending, load, playExternally] = useUnit([
		playbackStreamQuery.$data,
		playbackStreamQuery.$error,
		playbackStreamQuery.$pending,
		playbackStreamQuery.start,
		playbackModel.playRequested
	])

	useEffect(() => {
		load(fileId)
	}, [fileId, load])

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

	if (!canDirectPlay(stream.info.mime_codec, browserCanPlayType)) {
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
			stream={stream}
			heading={stream.title}
			subheading={subheading}
			onClose={close}
			onOpenExternally={openExternally}
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
