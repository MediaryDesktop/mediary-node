import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { formatProgress, preferredTitle, trackerQueries } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { ConnectAniList } from '@features/connect-anilist'

import styles from './ListsPage.module.scss'

const MEDIA_TYPES: readonly TrackerMediaType[] = ['anime', 'manga']

const STATUS_ORDER = ['CURRENT', 'REPEATING', 'PAUSED', 'PLANNING', 'COMPLETED', 'DROPPED'] as const

type TrackerStatus = (typeof STATUS_ORDER)[number]

function isKnownStatus(status: string): status is TrackerStatus {
	return (STATUS_ORDER as readonly string[]).includes(status)
}

function groupByStatus(entries: TrackerEntry[]): [TrackerStatus, TrackerEntry[]][] {
	const groups = new Map<TrackerStatus, TrackerEntry[]>()

	for (const entry of entries) {
		if (!isKnownStatus(entry.status)) {
			continue
		}

		const group = groups.get(entry.status) ?? []
		group.push(entry)
		groups.set(entry.status, group)
	}

	return STATUS_ORDER.flatMap(status => {
		const group = groups.get(status)
		return group ? [[status, group] as [TrackerStatus, TrackerEntry[]]] : []
	})
}

export function ListsPage() {
	const { t } = useTranslation()
	const [mediaType, setMediaType] = useState<TrackerMediaType>('anime')

	const query = trackerQueries[mediaType]

	const [connected, loaded, data, pending, error, start] = useUnit([
		aniListAccountModel.$connected,
		aniListAccountModel.$loaded,
		query.$data,
		query.$pending,
		query.$error,
		query.start
	])

	useEffect(() => {
		if (connected) {
			start()
		}
	}, [connected, start])

	const groups = useMemo(() => groupByStatus(data?.entries ?? []), [data])

	if (loaded && !connected) {
		return (
			<div className={styles.root}>
				<h1 className={styles.title}>{t('nav.lists')}</h1>
				<p className={styles.subtitle}>{t('lists.connect')}</p>

				<section className={styles.connect}>
					<ConnectAniList />
				</section>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1 className={styles.title}>{t('nav.lists')}</h1>

				<div className={styles.tabs} role='tablist'>
					{MEDIA_TYPES.map(type => (
						<button
							key={type}
							type='button'
							role='tab'
							aria-selected={type === mediaType}
							className={clsx(styles.tab, type === mediaType && styles.active)}
							onClick={() => setMediaType(type)}
						>
							{t(`lists.tabs.${type}`)}
						</button>
					))}
				</div>
			</header>

			{data?.stale && <p className={styles.notice}>{t('lists.stale')}</p>}

			{!data && pending && <p className={styles.muted}>{t('lists.loading')}</p>}

			{!data && !pending && error && (
				<div className={styles.failure}>
					<p className={styles.muted}>{t('lists.failed')}</p>
					<Button size='small' onClick={() => start()}>
						{t('lists.retry')}
					</Button>
				</div>
			)}

			{data && groups.length === 0 && <p className={styles.muted}>{t('lists.empty')}</p>}

			{groups.map(([status, entries]) => (
				<section key={status} className={styles.group}>
					<h2 className={styles.groupTitle}>
						{t(`lists.status.${mediaType}.${status}`)}
						<span className={styles.count}>{entries.length}</span>
					</h2>

					<ul className={styles.grid}>
						{entries.map(entry => (
							<li key={entry.media_ref} className={styles.card}>
								<div
									className={styles.cover}
									style={{ backgroundColor: entry.media.cover_color ?? undefined }}
								>
									{entry.media.cover_image && (
										<img src={entry.media.cover_image} alt='' loading='lazy' />
									)}
								</div>

								<p className={styles.cardTitle}>{preferredTitle(entry.media.title)}</p>

								<p className={styles.progress}>
									{mediaType === 'anime'
										? t('lists.episodes', {
												progress: formatProgress(entry.progress, entry.media.episodes)
											})
										: t('lists.chapters', {
												progress: formatProgress(entry.progress, entry.media.chapters)
											})}
								</p>
							</li>
						))}
					</ul>
				</section>
			))}

			{data?.sources && data.sources.length > 0 && (
				<footer className={styles.sources}>
					{data.sources.map(source => (
						<a key={source.id} href={source.url} target='_blank' rel='noreferrer'>
							{t('lists.source', { name: source.name })}
						</a>
					))}
				</footer>
			)}
		</div>
	)
}
