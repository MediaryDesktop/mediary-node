import { useTranslation } from '@shared/i18n'
import { Tooltip } from '@shared/ui'

import { MediaTypeIcon, TRACKER_STATUSES } from '@entities/tracker'
import type { TrackerStatus } from '@entities/tracker'

import type { StatusCounts, TypeBreakdown } from '../lib/stats'

import { useChartTheme } from './chart-theme'
import { Panel, PanelEmpty } from './Panel'
import styles from './Stats.module.scss'

export interface StatusByTypeProps {
	byType: TypeBreakdown[]
	byStatus: StatusCounts
	className?: string
}

export function StatusByType({ byType, byStatus, className }: StatusByTypeProps) {
	const { t } = useTranslation()
	const theme = useChartTheme()
	const colorOf = (status: TrackerStatus) => theme.statusColor[status]

	// Every bar is drawn against the longest one, so a type's length is how many
	// titles it has and its segments are how they split.
	const longest = Math.max(1, ...byType.map(row => row.total))

	return (
		<Panel
			className={className}
			icon='common/list-checks'
			accent={theme.series[1]}
			title={t('home.stats.byType.title')}
			subtitle={t('home.stats.byType.subtitle')}
		>
			{byType.length === 0 ? (
				<PanelEmpty>{t('home.empty')}</PanelEmpty>
			) : (
				<>
					<ul className={styles.legend}>
						{TRACKER_STATUSES.filter(status => byStatus[status] > 0).map(status => (
							<li key={status} className={styles.legendItem}>
								<span
									className={styles.swatch}
									style={{ background: colorOf(status) }}
									aria-hidden
								/>
								{t(`home.stats.status.${status}`)}
								<span className={styles.legendCount}>{byStatus[status]}</span>
							</li>
						))}
					</ul>

					<ul className={styles.typeRows}>
						{byType.map(row => {
							const typeLabel = t(`lists.mediaType.${row.type}`)

							return (
								<li key={row.type} className={styles.typeRow}>
									<span className={styles.typeHead}>
										<MediaTypeIcon type={row.type} size={16} />
										{typeLabel}
										<span className={styles.typeTotal}>{row.total}</span>
									</span>

									<span
										className={styles.stack}
										style={{ width: `${(row.total / longest) * 100}%` }}
									>
										{TRACKER_STATUSES.filter(status => row.counts[status] > 0).map(
											status => {
												const label = `${typeLabel} · ${t(`lists.status.${row.type}.${status}`)}: ${row.counts[status]}`

												return (
													<Tooltip key={status} content={label} delay={0}>
														<span
															role='img'
															aria-label={label}
															tabIndex={0}
															className={styles.segment}
															style={{
																background: colorOf(status),
																flexGrow: row.counts[status]
															}}
														/>
													</Tooltip>
												)
											}
										)}
									</span>
								</li>
							)
						})}
					</ul>
				</>
			)}
		</Panel>
	)
}
