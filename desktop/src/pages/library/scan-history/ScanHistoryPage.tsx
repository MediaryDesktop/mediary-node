import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatDateTime } from '@shared/lib'
import { Badge, EmptyState, Icon, PageHeader, PageTransition } from '@shared/ui'

import { libraryScanHistoryQuery } from '@entities/library-item'

import styles from './ScanHistoryPage.module.scss'
import { ScanRunDetail } from './ScanRunDetail'

const HISTORY_LIMIT = 50

export function ScanHistoryPage() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const [history, historyPending, startHistory] = useUnit([
		libraryScanHistoryQuery.$data,
		libraryScanHistoryQuery.$pending,
		libraryScanHistoryQuery.start
	])

	const [selectedId, setSelectedId] = useState<number | null>(null)

	useEffect(() => {
		startHistory({ limit: HISTORY_LIMIT })
	}, [startHistory])

	const runs = history?.history.items ?? []

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('library.history.title')}
				icon={<Icon name='common/clock' size={24} />}
				subtitle={t('library.history.description')}
				onBack={() => navigate({ to: '/library' })}
			/>

			{!historyPending && runs.length === 0 ? (
				<EmptyState title={t('library.history.empty')} />
			) : (
				<ul className={styles.runs}>
					{runs.map(run => (
						<li key={run.id}>
							<button
								type='button'
								className={styles.run}
								onClick={() => setSelectedId(run.id)}
							>
								<span className={styles.icon}>
									<Icon name='common/clock' size={18} />
								</span>

								<div className={styles.body}>
									<p className={styles.date}>
										{formatDateTime(run.started_at, i18n.language)}
									</p>

									<p className={styles.summary}>
										{[
											t('library.summary.files', { count: run.found }),
											t('library.scan.matchedFiles', { count: run.matched })
										].join(' · ')}
									</p>
								</div>

								{run.status === 'partial' && (
									<Badge tone='warning'>{t('library.history.partial')}</Badge>
								)}

								<Icon name='common/chevron-down' size={16} className={styles.chevron} />
							</button>
						</li>
					))}
				</ul>
			)}

			<ScanRunDetail runId={selectedId} onClose={() => setSelectedId(null)} />
		</PageTransition>
	)
}
