import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatRelativeTime } from '@shared/lib'
import { Badge, Button, Icon, Input, toast } from '@shared/ui'

import { addTorrentMutation, torrentSearchQuery } from '@entities/torrent'
import type { TorrentRelease } from '@entities/torrent'

import styles from './TorrentSearch.module.scss'

export interface TorrentSearchProps {
	mediaRef: string
	// The title's name; it also names the folder a download goes into.
	title: string
}

// Searching the user's Jackett or Prowlarr for the title. Nothing is asked until
// the user does: a search reaches sites the user chose, not the node's own.
export function TorrentSearch({ mediaRef, title }: TorrentSearchProps) {
	const { t, i18n } = useTranslation()

	const [result, error, pending, search, reset, add] = useUnit([
		torrentSearchQuery.$data,
		torrentSearchQuery.$error,
		torrentSearchQuery.$pending,
		torrentSearchQuery.start,
		torrentSearchQuery.reset,
		addTorrentMutation.start
	])

	const [query, setQuery] = useState('')
	const [episode, setEpisode] = useState('')
	const [adding, setAdding] = useState<string | null>(null)
	// The add mutation is shared with the add drawer; only this panel's adds are
	// this panel's to report.
	const ours = useRef(false)

	// Results belong to the title they were found for.
	useEffect(() => reset, [mediaRef, reset])

	useEffect(() => {
		const stop = [
			addTorrentMutation.finished.success.watch(() => {
				if (!ours.current) return
				ours.current = false
				setAdding(null)
				toast.success(t('torrents.search.added'), { id: 'torrent-search-add' })
			}),
			addTorrentMutation.finished.failure.watch(({ error: failure }) => {
				if (!ours.current) return
				ours.current = false
				setAdding(null)
				toast.error(failure.body?.detail ?? t('torrents.drawer.failed'), { id: 'torrent-search-add' })
			})
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		search({ mediaRef, episode: Number(episode) || 0, query })
	}

	const download = (found: TorrentRelease) => {
		ours.current = true
		setAdding(found.id)
		// A batch is held for the file choice; a single episode goes straight in.
		add({ media_ref: mediaRef, title, release_id: found.id, choose_files: found.batch })
	}

	const problem =
		error && 'body' in error ? (error.body as { detail?: string; status?: number } | null) : null
	const failedSources = (result?.sources ?? []).filter(source => source.error)
	const releases = result?.releases ?? []

	return (
		<section className={styles.root}>
			<form className={styles.form} onSubmit={submit}>
				<Input
					value={query}
					onChange={event => setQuery(event.target.value)}
					placeholder={t('torrents.search.placeholder')}
					startIcon={<Icon name='common/search' size={16} />}
					className={styles.query}
					aria-label={t('torrents.search.placeholder')}
				/>
				<Input
					type='number'
					min={0}
					value={episode}
					onChange={event => setEpisode(event.target.value)}
					placeholder={t('torrents.search.episode')}
					className={styles.episode}
					aria-label={t('torrents.search.episode')}
				/>
				<Button type='submit' loading={pending}>
					{t('torrents.search.submit')}
				</Button>
			</form>

			{result && (
				<p className={styles.hint}>
					{t('torrents.search.queries', { queries: (result.queries ?? []).join(' · ') })}
				</p>
			)}

			{problem?.status === 428 && (
				<p className={styles.notice}>
					{t('torrents.search.noSources')}{' '}
					<Link to='/settings' className={styles.link}>
						{t('torrents.client.openSettings')}
					</Link>
				</p>
			)}
			{error && problem?.status !== 428 && (
				<p className={styles.problem}>{problem?.detail ?? t('torrents.search.failed')}</p>
			)}

			{failedSources.map(source => (
				<p key={source.id} className={styles.problem}>
					{t('torrents.search.sourceFailed', { name: source.name, error: source.error ?? '' })}
				</p>
			))}

			{result && releases.length === 0 && <p className={styles.empty}>{t('torrents.search.empty')}</p>}

			{releases.length > 0 && (
				<ul className={styles.list}>
					{releases.map(found => (
						<li key={found.id} className={styles.row}>
							<div className={styles.body}>
								<p className={styles.name} title={found.title}>
									{found.title}
								</p>

								<div className={styles.badges}>
									{found.match === 'episode' && (
										<Badge tone='success'>{t('torrents.search.match.episode')}</Badge>
									)}
									{found.match === 'batch' && (
										<Badge tone='info'>{t('torrents.search.match.batch')}</Badge>
									)}
									{found.match === 'any' && found.batch && (
										<Badge tone='info'>{t('torrents.search.match.batch')}</Badge>
									)}
									{found.episodes && (
										<Badge>
											{found.episodes.from === found.episodes.to
												? t('torrents.files.episode', { number: found.episodes.from })
												: t('torrents.search.episodes', {
														from: found.episodes.from,
														to: found.episodes.to
													})}
										</Badge>
									)}
									{found.resolution && <Badge>{found.resolution}</Badge>}
									{found.codec && <Badge>{found.codec}</Badge>}
									{found.group && <Badge tone='accent'>{found.group}</Badge>}
								</div>

								<p className={styles.meta}>
									<span className={styles.seeds}>↑ {found.seeders}</span>
									<span className={styles.peers}>↓ {found.peers}</span>
									{found.size > 0 && <span>{formatBytes(found.size)}</span>}
									{found.published_at && (
										<span>
											{formatRelativeTime(found.published_at, i18n.language, {
												maxUnit: 'year'
											})}
										</span>
									)}
									<span>{found.indexer || found.source_name}</span>
								</p>
							</div>

							<div className={styles.actions}>
								{found.page_url && (
									<Button
										size='small'
										variant='ghost'
										iconOnly
										aria-label={t('torrents.search.page')}
										title={t('torrents.search.page')}
										startIcon={<Icon name='common/external-link' size={14} />}
										onClick={() => window.open(found.page_url, '_blank', 'noreferrer')}
									/>
								)}
								<Button
									size='small'
									startIcon={<Icon name='common/download' size={14} />}
									loading={adding === found.id}
									disabled={adding !== null}
									onClick={() => download(found)}
								>
									{t('torrents.search.download')}
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
