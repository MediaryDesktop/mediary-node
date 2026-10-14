import { useTranslation } from '@shared/i18n'

import { TRACKER_MEDIA_TYPES, TRACKER_STATUSES } from '@entities/tracker'
import type { TrackerStatus } from '@entities/tracker'

import { useChartTheme } from '../../../config/chart-theme'
import { emptyCounts } from '../../../lib/stats'
import type { StatusCounts, TypeBreakdown } from '../../../lib/stats'
import { Panel, PanelEmpty, iconStyle } from '../panel/Panel'

import styles from './StatusByType.module.scss'

export interface StatusByTypeProps {
	byType: TypeBreakdown[]
	byStatus: StatusCounts
	className?: string
}

export function StatusByType({ byType, byStatus, className }: StatusByTypeProps) {
	const { t } = useTranslation()
	const theme = useChartTheme()
	const colorOf = (status: TrackerStatus) => theme.statusColor[status]
	const grandTotal = TRACKER_STATUSES.reduce((sum, status) => sum + byStatus[status], 0)

	// Every kind gets a row, even one the user has never tracked — it reads as "0
	// of these" instead of silently dropping off the table.
	const rows = TRACKER_MEDIA_TYPES.map(
		type => byType.find(row => row.type === type) ?? { type, total: 0, counts: emptyCounts() }
	)

	return (
		<Panel
			className={className}
			icon='common/list-checks'
			accent={theme.series[1]}
			title={t('home.stats.byType.title')}
			subtitle={t('home.stats.byType.subtitle')}
		>
			{grandTotal === 0 ? (
				<PanelEmpty>{t('home.empty')}</PanelEmpty>
			) : (
				<div className={styles.scroll}>
					<div className={styles.table}>
						<div className={styles.row}>
							<span />
							{TRACKER_STATUSES.map(status => (
								<span key={status} className={styles.statusHead}>
									<span
										className={styles.dot}
										style={{ background: colorOf(status) }}
										aria-hidden
									/>
									{t(`home.stats.status.${status}`)}
								</span>
							))}
							<span className={styles.totalHead}>{t('home.stats.byType.total')}</span>
						</div>

						{rows.map(row => (
							<div key={row.type} className={styles.row}>
								<span className={styles.typeLabel}>{t(`lists.mediaType.${row.type}`)}</span>
								{TRACKER_STATUSES.map(status => {
									const count = row.counts[status]
									return count > 0 ? (
										<span
											key={status}
											className={styles.cell}
											style={iconStyle(colorOf(status))}
										>
											{count}
										</span>
									) : (
										<span key={status} className={styles.cellEmpty} aria-hidden>
											—
										</span>
									)
								})}
								<span className={styles.rowTotal}>{row.total > 0 ? row.total : '—'}</span>
							</div>
						))}

						<div className={styles.footerRow}>
							<span className={styles.allLabel}>{t('home.stats.byType.all')}</span>
							{TRACKER_STATUSES.map(status => (
								<span
									key={status}
									className={styles.footerCell}
									style={{ color: colorOf(status) }}
								>
									{byStatus[status] > 0 ? byStatus[status] : '—'}
								</span>
							))}
							<span className={styles.grandTotal}>{grandTotal}</span>
						</div>
					</div>
				</div>
			)}
		</Panel>
	)
}
