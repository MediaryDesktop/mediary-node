import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { ProgressBar, ReelLoader } from '@shared/ui'

import type { TorrentStream } from '@entities/torrent'

import type { StreamTarget } from '@features/stream-torrent'

import styles from './PreparingStream.module.scss'

export interface PreparingStreamProps {
	target: StreamTarget
	stream: TorrentStream | null
	error: string | null
}

// What the player shows in place of the picture while a stream is readied, as
// Seanime's torrent streaming view does: a pill with the numbers moving behind
// the scenes, and the title and status centered under the spinner.
export function PreparingStream({ target, stream, error }: PreparingStreamProps) {
	const { t } = useTranslation()

	// The node names its own client in English; the app names it in the user's tongue.
	const service = stream?.via === 'embedded' ? t('torrents.stream.builtIn') : (stream?.service ?? '')
	const preparing = stream?.state === 'preparing'
	const percent = preparing ? Math.floor(stream.progress * 100) : 0

	const status = error
		? error
		: !stream
			? t('torrents.stream.starting')
			: stream.state === 'queued'
				? t('torrents.stream.queued', { service })
				: t('torrents.stream.preparing', { service, percent })

	// Who the built-in client gets the file from, and how fast.
	const swarm =
		stream?.via === 'embedded' && preparing
			? t('torrents.stream.swarm', {
					count: stream.peers ?? 0,
					speed: `${formatBytes(stream.speed)}/s`
				})
			: null

	return (
		<>
			{preparing && (
				<div className={styles.pill} role='status'>
					<span className={styles.percent}>{percent}%</span>
					{swarm && <span>{swarm}</span>}
					<ProgressBar value={percent} max={100} label={status} className={styles.bar} />
				</div>
			)}

			<div className={styles.center}>
				{!error && <ReelLoader spinning />}
				<p className={styles.heading}>{target.label}</p>
				<p className={error ? styles.error : styles.status}>{status}</p>
				{stream?.release && (
					<p className={styles.release} title={stream.release}>
						{stream.release}
					</p>
				)}
			</div>
		</>
	)
}
