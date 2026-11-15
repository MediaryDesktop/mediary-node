import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon, Input, ReelLoader } from '@shared/ui'

import type { StreamVideo, TorrentStream } from '@entities/torrent'

import type { StreamTarget } from '@features/stream-torrent'

import styles from './PreparingStream.module.scss'

export interface PreparingStreamProps {
	target: StreamTarget
	stream: TorrentStream | null
	error: string | null
	onStop: () => void
	onChooseFile: (fileId: number) => void
}

const FILTER_FROM = 10

function splitPath(path: string): { name: string; folder: string } {
	const cut = path.lastIndexOf('/')

	return cut < 0 ? { name: path, folder: '' } : { name: path.slice(cut + 1), folder: path.slice(0, cut) }
}

export function matchingFiles(files: readonly StreamVideo[], filter: string): StreamVideo[] {
	const words = filter.toLowerCase().split(/\s+/u).filter(Boolean)

	return files.filter(file => words.every(word => file.path.toLowerCase().includes(word)))
}

export function PreparingStream({ target, stream, error, onStop, onChooseFile }: PreparingStreamProps) {
	const { t } = useTranslation()
	const [expanded, setExpanded] = useState(false)
	const [choosing, setChoosing] = useState(false)
	const [filter, setFilter] = useState('')

	const files = stream?.files ?? []
	const shownFiles = matchingFiles(files, filter)
	const chooseFile = () => {
		setExpanded(true)
		setChoosing(true)
	}

	const cut = target.label.lastIndexOf(' · ')
	const title = cut > 0 ? target.label.slice(0, cut) : target.label
	const episode = cut > 0 ? target.label.slice(cut + 3) : null

	const embedded = stream?.via === 'embedded'
	const fetching = !error && stream?.state === 'preparing'
	const percent = fetching ? (stream.progress * 100).toFixed(1) : '0.0'
	const speed = `${formatBytes(fetching ? stream.speed : 0)}/s`
	const upload = `${formatBytes(fetching ? (stream.upload ?? 0) : 0)}/s`
	const peers = embedded ? (stream?.peers ?? 0) : (stream?.seeders ?? 0)
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
			className={clsx(styles.iconButton, styles.danger)}
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
			<section className={clsx(styles.box, expanded && styles.open)} aria-label={target.label}>
				<header className={styles.bar}>
					<div className={styles.barContent}>
						<div className={clsx(styles.layer, !expanded && styles.shown)} aria-hidden={expanded}>
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
						</div>
						<div className={clsx(styles.layer, expanded && styles.shown)} aria-hidden={!expanded}>
							<span className={styles.titles}>
								<span className={styles.title}>{title}</span>
								{episode && <span className={styles.episode}>{episode}</span>}
							</span>
						</div>
					</div>
					{toggle}
					{stop}
				</header>

				<div className={styles.drawer} aria-hidden={!expanded}>
					<div className={styles.drawerInner}>
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
											<span className={clsx(styles.tag, styles[candidate.state])}>
												{t(`torrents.stream.candidate.${candidate.state}`)}
											</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{files.length > 0 &&
							(choosing ? (
								<div className={styles.block}>
									<p className={styles.section}>{t('torrents.stream.files')}</p>

									{files.length >= FILTER_FROM && (
										<Input
											value={filter}
											onChange={event => setFilter(event.target.value)}
											placeholder={t('torrents.stream.filesFilter')}
											startIcon={<Icon name='common/search' size={16} />}
										/>
									)}

									<ul className={styles.files}>
										{shownFiles.map(file => {
											const { name, folder } = splitPath(file.path)

											return (
												<li key={file.id}>
													<button
														type='button'
														className={clsx(
															styles.file,
															name === stream?.name && styles.current
														)}
														title={file.path}
														onClick={() => onChooseFile(file.id)}
													>
														<span className={styles.fileText}>
															<span className={styles.fileName}>{name}</span>
															{folder && (
																<span className={styles.fileFolder}>
																	{folder}
																</span>
															)}
														</span>
														<span className={styles.score}>
															{formatBytes(file.size)}
														</span>
													</button>
												</li>
											)
										})}
										{shownFiles.length === 0 && (
											<li className={styles.none}>{t('torrents.stream.filesNone')}</li>
										)}
									</ul>
								</div>
							) : (
								<Button variant='secondary' onClick={() => setChoosing(true)}>
									{t('torrents.stream.chooseFile')}
								</Button>
							))}

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
					</div>
				</div>
			</section>

			<div className={styles.center}>
				{error ? (
					<div className={styles.failure} role='alert'>
						<p className={styles.failureTitle}>{t('torrents.stream.failedTitle')}</p>
						<p className={styles.failureText}>{error}</p>
						<div className={styles.failureActions}>
							{files.length > 0 && (
								<Button variant='primary' onClick={chooseFile}>
									{t('torrents.stream.chooseFile')}
								</Button>
							)}
							<Button onClick={onStop}>{t('torrents.stream.close')}</Button>
						</div>
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
