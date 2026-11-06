import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import type { TrackerEntry } from '@entities/tracker'

import { useChartTheme } from '../../../config/chart-theme'
import type { TrackerStats as Stats } from '../../../lib/stats'
import { ActivityChart } from '../activity-chart/ActivityChart'
import { GenresDonut } from '../genres-donut/GenresDonut'
import { iconStyle } from '../panel/Panel'
import { ScoresChart } from '../scores-chart/ScoresChart'
import { StatusByType } from '../status-by-type/StatusByType'
import { TopRated } from '../top-rated/TopRated'

import styles from './TrackerStats.module.scss'

export interface TrackerStatsProps {
	stats: Stats
	entries: TrackerEntry[]
}

interface Tile {
	key: string
	icon: IconName
	label: string
	value: string
	note: string
	accent?: string
	progress?: number
	badges?: string[]
}

export function TrackerStats({ stats, entries }: TrackerStatsProps) {
	const { t, i18n } = useTranslation()
	const theme = useChartTheme()
	const format = new Intl.NumberFormat(i18n.language).format

	const tiles: Tile[] = [
		{
			key: 'titles',
			icon: 'common/list',
			label: t('home.stats.titles'),
			value: format(stats.titles),
			note:
				stats.completedThisMonth > 0
					? t('home.stats.completedThisMonth', { count: stats.completedThisMonth })
					: t('home.stats.typesNote', { count: stats.byType.length }),
			accent: theme.series[5]
		},
		{
			key: 'episodes',
			icon: 'common/play',
			label: t('home.stats.episodes'),
			value: format(stats.episodes),
			note: t('home.stats.acrossNote', { count: stats.watchedTitles }),
			accent: theme.series[0]
		},
		{
			key: 'chapters',
			icon: 'common/book-open',
			label: t('home.stats.chapters'),
			value: format(stats.chapters),
			note: t('home.stats.acrossNote', { count: stats.readTitles }),
			accent: theme.series[2]
		},
		{
			key: 'score',
			icon: 'common/star',
			label: t('home.stats.meanScore'),
			value: stats.meanScore === null ? '—' : stats.meanScore.toFixed(1),
			note: t('home.stats.scoredNote', { count: stats.scored }),
			accent: theme.series[3],
			progress: stats.meanScore === null ? undefined : stats.meanScore / 10
		},
		{
			key: 'genres',
			icon: 'common/sparkles',
			label: t('home.stats.topGenres'),
			value:
				stats.genres.length > 0
					? stats.genres
							.slice(0, 3)
							.map(genre => genre.name)
							.join(', ')
					: '—',
			note: t('home.stats.topGenresNote'),
			badges: stats.genres.length > 0 ? stats.genres.slice(0, 3).map(genre => genre.name) : undefined,
			accent: theme.series[6]
		}
	]

	return (
		<div className={styles.root}>
			<dl className={styles.tiles}>
				{tiles.map(tile => (
					<div
						key={tile.key}
						className={styles.tile}
						style={tile.accent ? ({ '--tile-accent': tile.accent } as CSSProperties) : undefined}
					>
						<span className={styles.tileHead}>
							<span className={styles.tileIcon} style={iconStyle(tile.accent)} aria-hidden>
								<Icon name={tile.icon} size={18} />
							</span>
							<dt className={styles.tileLabel}>{tile.label}</dt>
						</span>

						{tile.badges ? (
							<ul className={styles.tileBadges}>
								{tile.badges.map(name => (
									<li
										key={name}
										className={styles.tileBadge}
										style={iconStyle(tile.accent)}
									>
										{name}
									</li>
								))}
							</ul>
						) : (
							<dd className={styles.tileValue} title={tile.value}>
								{tile.value}
								{tile.progress != null && <span className={styles.tileUnit}>/ 10</span>}
							</dd>
						)}

						{tile.progress != null && (
							<div className={styles.tileBar}>
								<div
									className={styles.tileBarFill}
									style={{
										width: `${Math.max(0, Math.min(1, tile.progress)) * 100}%`,
										background: tile.accent
									}}
								/>
							</div>
						)}

						<dd className={styles.tileNote}>{tile.note}</dd>
					</div>
				))}
			</dl>

			<div className={styles.grid}>
				<ActivityChart entries={entries} className={styles.wide} />
				<StatusByType byType={stats.byType} byStatus={stats.byStatus} className={styles.byType} />
				<GenresDonut genres={stats.genres} total={stats.genreTags} className={styles.genres} />
				<TopRated entries={stats.topRated} className={styles.side} />
				<ScoresChart
					scores={stats.scores}
					mean={stats.meanScore}
					scored={stats.scored}
					className={styles.scores}
				/>
			</div>
		</div>
	)
}
