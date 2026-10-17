import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon, ReelLoader } from '@shared/ui'

import type { TorrentStream } from '@entities/torrent'

import type { StreamTarget } from '@features/stream-torrent'

import styles from './PreparingStream.module.scss'

export interface PreparingStreamProps {
	target: StreamTarget
	stream: TorrentStream | null
	error: string | null
	onStop: () => void
}

// What the player shows in place of the picture while a stream is readied, laid
// out as Seanime's torrent streaming does: a pill over the player with how far it
// is, which opens into a card with the releases auto-select lined up, and the
// status under the spinner. A failure stays on screen until it is closed.
export function PreparingStream({ target, stream, error, onStop }: PreparingStreamProps) {
	const { t } = useTranslation()
	const [expanded, setExpanded] = useState(false)

	// "Title · Episode 7" reads as a title over its episode, as the player heads it.
	const cut = target.label.lastIndexOf(' · ')
	const title = cut > 0 ? target.label.slice(0, cut) : target.label
	const episode = cut > 0 ? target.label.slice(cut + 3) : null

	const embedded = stream?.via === 'embedded'
	// The numbers are there once the torrent is being fetched; before, the status says what is going on.
	const fetching = !error && stream?.state === 'preparing'
	const percent = fetching ? (stream.progress * 100).toFixed(1) : '0.0'
	const speed = `${formatBytes(fetching ? stream.speed : 0)}/s`
	const upload = `${formatBytes(fetching ? (stream.upload ?? 0) : 0)}/s`
	const peers = embedded ? (stream?.peers ?? 0) : (stream?.seeders ?? 0)
	// The node names its own client in English; the app names it in the user's tongue.
	const service = embedded ? t('torrents.stream.builtIn') : (stream?.service ?? '')

	const status = error
		? error
		: !stream
			? target.params.auto
				? t('torrents.stream.searching')
				: t('torrents.stream.starting')
			: stream.state === 'queued'
				? t('torrents.stream.queued', { service })
				: embedded && !stream.name
					? t('torrents.stream.metadata')
					: embedded
						? t('torrents.stream.buffering', { percent: Math.floor(stream.progress * 100) })
						: t('torrents.stream.preparing', {
								service,
								percent: Math.floor(stream.progress * 100)
							})

	const candidates = stream?.candidates ?? []

	const stop = (
		<button
			type='button'
			className={clsx(styles.iconButton, expanded && styles.danger)}
			aria-label={t('torrents.stream.stop')}
			title={t('torrents.stream.stop')}
			onClick={onStop}
		>
			<span className={styles.square} aria-hidden />
		</button>
	)

	const toggle = (
		<button
			type='button'
			className={clsx(styles.iconButton, expanded && styles.flipped)}
			aria-label={expanded ? t('torrents.stream.collapse') : t('torrents.stream.expand')}
			aria-expanded={expanded}
			onClick={() => setExpanded(on => !on)}
		>
			<Icon name='common/chevron-down' size={18} />
		</button>
	)

	return (
		<div className={styles.view}>
			{expanded ? (
				<section className={styles.card} aria-label={target.label}>
					<header className={styles.head}>
						<div className={styles.titles}>
							<p className={styles.title}>{title}</p>
							{episode && <p className={styles.episode}>{episode}</p>}
						</div>
						{toggle}
						{stop}
					</header>

					{!fetching && (
						<div className={clsx(styles.status, error && styles.statusFailed)} role='status'>
							{!error && <span className={styles.spinner} aria-hidden />}
							<span>{status}</span>
						</div>
					)}

					{candidates.length > 0 && (
						<div className={styles.block}>
							<p className={styles.section}>{t('torrents.stream.candidates')}</p>
							<ul className={styles.candidates}>
								{candidates.map((candidate, index) => (
									<li
										key={`${index}-${candidate.title}`}
										className={clsx(
											styles.candidate,
											candidate.state === 'trying' && styles.current
										)}
										title={candidate.error ?? candidate.title}
									>
										<span className={styles.candidateText}>
											<span className={styles.candidateTitle}>{candidate.title}</span>
											{candidate.source && (
												<span className={styles.candidateSource}>
													{candidate.source}
												</span>
											)}
										</span>
										<span className={styles.score}>
											{t('torrents.stream.score', { score: candidate.score })}
										</span>
										<span className={clsx(styles.tag, styles[candidate.state])}>
											{t(`torrents.stream.candidate.${candidate.state}`)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{fetching && (
						<div className={styles.stats}>
							<div className={styles.statsRow}>
								<span>
									{t('torrents.stream.speed')} <strong>{speed}</strong>
								</span>
								<span>
									{t('torrents.stream.seeders')} <strong>{stream.seeders ?? 0}</strong>
								</span>
							</div>
							<div className={styles.track}>
								<span className={styles.fill} style={{ width: `${percent}%` }} />
							</div>
							<div className={clsx(styles.statsRow, styles.muted)}>
								<span>{t('torrents.stream.complete', { percent })}</span>
								<span>{t('torrents.stream.upload', { speed: upload })}</span>
							</div>
						</div>
					)}
				</section>
			) : (
				<div className={styles.pill} role='status' aria-label={status}>
					{fetching ? (
						<span className={styles.numbers}>
							<strong>{percent}%</strong>
							<span className={styles.number}>
								<Icon name='common/users' size={14} />
								{peers}
							</span>
							<span className={styles.number}>▽ {speed}</span>
							<span className={styles.number}>△ {upload}</span>
						</span>
					) : (
						<span className={clsx(styles.pillStatus, error && styles.statusFailed)}>
							{status}
						</span>
					)}
					{toggle}
					{stop}
				</div>
			)}

			<div className={styles.center}>
				{error ? (
					<div className={styles.failure} role='alert'>
						<p className={styles.failureTitle}>{t('torrents.stream.failedTitle')}</p>
						<p className={styles.failureText}>{error}</p>
						<Button onClick={onStop}>{t('torrents.stream.close')}</Button>
					</div>
				) : (
					<>
						<ReelLoader spinning />
						<p className={styles.centerText}>{status}</p>
					</>
				)}
			</div>
		</div>
	)
}
