import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, PageTransition, Tabs } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard } from '@entities/media'
import { trackerQueries } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { ConnectAniList } from '@features/connect-anilist'
import { EntryMenu } from '@features/track-media'

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
	const navigate = useNavigate()
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
		<PageTransition className={styles.root}>
			<header className={styles.header}>
				<h1 className={styles.title}>{t('nav.lists')}</h1>

				<Tabs
					value={mediaType}
					onValueChange={setMediaType}
					items={MEDIA_TYPES.map(type => ({ value: type, label: t(`lists.tabs.${type}`) }))}
				/>
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
							<li key={entry.media_ref}>
								<MediaCard
									media={entry.media}
									scoreBadge={entry.score > 0 ? entry.score : undefined}
									menu={<EntryMenu entry={entry} mediaType={mediaType} />}
									previewRef={entry.media_ref}
									onOpen={() =>
										navigate({
											to: '/media/$mediaRef',
											params: { mediaRef: entry.media_ref }
										})
									}
								/>
							</li>
						))}
					</ul>
				</section>
			))}
		</PageTransition>
	)
}
