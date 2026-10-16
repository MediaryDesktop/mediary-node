import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, useUnitWatch } from '@shared/lib'
import { Button, Icon, ProgressBar, toast } from '@shared/ui'

import { playbackModel } from '@entities/playback'

import { $stream, $streamTarget, streamCancelled } from './model/model'
import styles from './TorrentStreamOverlay.module.scss'

// While a stream is readied, by the debrid service or the built-in client: what
// is coming, how far it is, and a way to give up on it. Gone once the player opens.
export function TorrentStreamOverlay() {
	const { t } = useTranslation()
	const [target, stream, cancel] = useUnit([$streamTarget, $stream, streamCancelled])

	// mpv is started by the node, and a failure to start it is only heard here
	// when the stream view, not the library, is on screen.
	useUnitWatch(playbackModel.playFailed, ({ error }) =>
		toast.error(problemDetail(error, t('playback.failed')), { id: 'playback-failed' })
	)

	if (!target) {
		return null
	}

	// The node names its own client in English; the app names it in the user's tongue.
	const service = stream?.via === 'embedded' ? t('torrents.stream.builtIn') : (stream?.service ?? '')

	const status = !stream
		? t('torrents.stream.starting')
		: stream.state === 'queued'
			? t('torrents.stream.queued', { service })
			: t('torrents.stream.preparing', {
					service,
					percent: Math.floor(stream.progress * 100)
				})

	// Who the built-in client gets it from, and how fast: with no peers it waits.
	const swarm =
		stream?.via === 'embedded' && stream.state === 'preparing'
			? t('torrents.stream.swarm', {
					count: stream.peers ?? 0,
					speed: `${formatBytes(stream.speed)}/s`
				})
			: null

	return (
		<div className={styles.overlay} role='status' aria-live='polite'>
			<span className={styles.icon}>
				<Icon name='common/play' size={20} />
			</span>

			<div className={styles.body}>
				<p className={styles.label}>{target.label}</p>
				<p className={styles.status}>{status}</p>
				{swarm && <p className={styles.release}>{swarm}</p>}
				{stream?.release && (
					<p className={styles.release} title={stream.release}>
						{stream.release}
					</p>
				)}
				<ProgressBar
					value={stream && stream.state === 'preparing' ? stream.progress * 100 : 0}
					max={stream && stream.state === 'preparing' ? 100 : null}
					label={status}
					className={styles.bar}
				/>
			</div>

			<Button size='small' variant='secondary' onClick={cancel}>
				{t('torrents.stream.cancel')}
			</Button>
		</div>
	)
}
