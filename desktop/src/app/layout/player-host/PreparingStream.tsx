import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Badge, Button, Icon, ProgressBar, ReelLoader } from '@shared/ui'
import type { BadgeTone } from '@shared/ui'

import type { TorrentStream } from '@entities/torrent'

import type { StreamTarget } from '@features/stream-torrent'

import styles from './PreparingStream.module.scss'

type CandidateState = NonNullable<TorrentStream['candidates']>[number]['state']

const CANDIDATE_TONE: Record<CandidateState, BadgeTone> = {
	trying: 'warning',
	waiting: 'neutral',
	failed: 'danger'
}

export interface PreparingStreamProps {
	target: StreamTarget
	stream: TorrentStream | null
	error: string | null
	onStop: () => void
}

// What the player shows in place of the picture while a stream is readied, as
// Seanime's torrent streaming view does: a card over the player with the
// releases auto-select lined up and how far the one being tried is, and the
// status under the spinner. A failure stays on screen until it is closed.
export function PreparingStream({ target, stream, error, onStop }: PreparingStreamProps) {
	const { t } = useTranslation()
	const [expanded, setExpanded] = useState(true)

	// "Title · Episode 7" reads as a title over its episode, as the player heads it.
	const cut = target.label.lastIndexOf(' · ')
	const title = cut > 0 ? target.label.slice(0, cut) : target.label
	const episode = cut > 0 ? target.label.slice(cut + 3) : null

	const embedded = stream?.via === 'embedded'
	const preparing = stream?.state === 'preparing'
	const percent = preparing ? Math.floor(stream.progress * 100) : 0
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
						? t('torrents.stream.buffering', { percent })
						: t('torrents.stream.preparing', { service, percent })

	const candidates = stream?.candidates ?? []
	const trying = candidates.find(candidate => candidate.state === 'trying')

	return (
		<div className={styles.view}>
			<section className={styles.card} aria-label={target.label}>
				<header className={styles.head}>
					<div className={styles.titles}>
						<p className={styles.title}>{title}</p>
						{episode && <p className={styles.episode}>{episode}</p>}
					</div>
					<button
						type='button'
						className={clsx(styles.iconButton, expanded && styles.expanded)}
						aria-label={expanded ? t('torrents.stream.collapse') : t('torrents.stream.expand')}
						aria-expanded={expanded}
						onClick={() => setExpanded(on => !on)}
					>
						<Icon name='common/chevron-down' size={18} />
					</button>
					<button
						type='button'
						className={clsx(styles.iconButton, styles.stop)}
						aria-label={t('torrents.stream.stop')}
						title={t('torrents.stream.stop')}
						onClick={onStop}
					>
						<Icon name='common/close' size={18} />
					</button>
				</header>

				{expanded && (
					<>
						<div className={clsx(styles.status, error && styles.statusFailed)} role='status'>
							{!error && <span className={styles.spinner} aria-hidden />}
							<span>{status}</span>
						</div>

						{candidates.length > 0 && (
							<>
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
												<span className={styles.candidateTitle}>
													{candidate.title}
												</span>
												{candidate.source && (
													<span className={styles.candidateSource}>
														{candidate.source}
													</span>
												)}
											</span>
											<span className={styles.score}>
												{t('torrents.stream.score', { score: candidate.score })}
											</span>
											<Badge tone={CANDIDATE_TONE[candidate.state]}>
												{t(`torrents.stream.candidate.${candidate.state}`)}
											</Badge>
										</li>
									))}
								</ul>
							</>
						)}

						{!error && (
							<div className={styles.stats}>
								<div className={styles.statsRow}>
									<span>
										{t('torrents.stream.speed')}{' '}
										<strong>{formatBytes(preparing ? stream.speed : 0)}/s</strong>
									</span>
									{embedded ? (
										<span>
											{t('torrents.stream.peers')} <strong>{stream.peers ?? 0}</strong>
										</span>
									) : trying ? (
										<span>
											{t('torrents.stream.seeders')} <strong>{trying.seeders}</strong>
										</span>
									) : null}
								</div>
								<ProgressBar value={percent} max={100} label={status} />
								<div className={styles.statsRow}>
									<span>{t('torrents.stream.complete', { percent })}</span>
									{stream?.name && (
										<span className={styles.file} title={stream.name}>
											{stream.name}
										</span>
									)}
								</div>
							</div>
						)}
					</>
				)}
			</section>

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
