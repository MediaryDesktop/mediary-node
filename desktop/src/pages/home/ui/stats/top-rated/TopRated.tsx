import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { preferredTitle } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { useChartTheme } from '../../../config/chart-theme'
import { Panel, PanelEmpty } from '../panel/Panel'

import styles from './TopRated.module.scss'

export interface TopRatedProps {
	entries: TrackerEntry[]
	className?: string
}

export function TopRated({ entries, className }: TopRatedProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const theme = useChartTheme()

	return (
		<Panel
			className={className}
			icon='common/heart'
			accent={theme.series[4]}
			title={t('home.stats.topRated.title')}
			subtitle={t('home.stats.topRated.subtitle')}
		>
			{entries.length === 0 ? (
				<PanelEmpty>{t('home.stats.topRated.empty')}</PanelEmpty>
			) : (
				<ol className={styles.ranking}>
					{entries.map(entry => (
						<li key={entry.media_ref}>
							<button
								type='button'
								className={styles.rankRow}
								onClick={() =>
									navigate({
										to: '/media/$mediaRef',
										params: { mediaRef: entry.media_ref }
									})
								}
							>
								<span
									className={styles.rankCover}
									style={{ backgroundColor: entry.media.cover_color ?? undefined }}
								>
									{entry.media.cover_image && (
										<img
											src={entry.media.cover_image}
											alt=''
											loading='lazy'
											draggable={false}
										/>
									)}
								</span>
								<span className={styles.rankText}>
									<span className={styles.rankTitle}>
										{preferredTitle(entry.media.title)}
									</span>
									<span className={styles.rankType}>
										{t(`lists.mediaType.${entry.media_type}` as never)}
										{entry.media.season_year ? ` · ${entry.media.season_year}` : ''}
									</span>
								</span>
								<span className={styles.rankScore}>
									<Icon name='common/star' size={13} />
									{(entry.score / 10).toFixed(1)}
								</span>
							</button>
						</li>
					))}
				</ol>
			)}
		</Panel>
	)
}
