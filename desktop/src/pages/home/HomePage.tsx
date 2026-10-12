import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, PageTransition } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { useTrackedEntries } from '@entities/tracker'
import type { TrackerEntry, TrackerStatus } from '@entities/tracker'

import { ConnectAniList } from '@features/connect-anilist'
import { ContinueWatching, useContinueWatching } from '@features/continue-watching'

import styles from './HomePage.module.scss'
import { trackerStats } from './lib/stats'
import { HomeBanner } from './ui/banner/HomeBanner'
import { TrackerStats } from './ui/stats/tracker-stats/TrackerStats'
import { TrackerRow } from './ui/tracker-row/TrackerRow'

const ROWS: { status: TrackerStatus; key: 'current' | 'planning' | 'completed' }[] = [
	{ status: 'CURRENT', key: 'current' },
	{ status: 'PLANNING', key: 'planning' },
	{ status: 'COMPLETED', key: 'completed' }
]

// What the user is in the middle of, first: the anime they are watching, the next
// episode the library holds, then the lists and how it all adds up. Discovering
// something new is Discover's job, not this page's.
export function HomePage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [connected, sessionLoaded] = useUnit([aniListAccountModel.$connected, aniListAccountModel.$loaded])

	const entries = useTrackedEntries(connected)
	const watching = useContinueWatching(entries)
	const stats = useMemo(() => trackerStats(entries), [entries])

	// One title, one card: a dorama the node also lists as a series is shown once.
	const byStatus = useMemo(() => {
		const unique = [...new Map(entries.map(entry => [entry.media_ref, entry])).values()].sort(
			(a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
		)
		const rows = new Map<string, TrackerEntry[]>()

		for (const entry of unique) {
			rows.set(entry.status, [...(rows.get(entry.status) ?? []), entry])
		}

		return rows
	}, [entries])

	const openMedia = (mediaRef: string) => navigate({ to: '/media/$mediaRef', params: { mediaRef } })

	return (
		<PageTransition className={styles.root}>
			<HomeBanner entries={entries} watching={watching} onOpen={openMedia} />

			{sessionLoaded && !connected && (
				<section className={styles.connect}>
					<p className={styles.connectText}>{t('home.connect')}</p>
					<ConnectAniList />
				</section>
			)}

			<ContinueWatching state={watching} />

			{entries.length === 0 ? (
				<EmptyState title={t('home.empty')} />
			) : (
				<>
					{ROWS.map(row => (
						<TrackerRow
							key={row.status}
							title={t(`home.rows.${row.key}`)}
							status={row.status}
							entries={byStatus.get(row.status) ?? []}
						/>
					))}

					<section className={styles.section}>
						<h2 className={styles.sectionTitle}>{t('home.stats.title')}</h2>
						<TrackerStats stats={stats} entries={entries} />
					</section>
				</>
			)}
		</PageTransition>
	)
}
