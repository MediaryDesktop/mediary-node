import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { useTranslation } from '@shared/i18n'

import { useChartTheme } from '../../../config/chart-theme'
import type { GenreCount } from '../../../lib/stats'
import { ChartTooltip, Panel, PanelEmpty } from '../panel/Panel'
import stats from '../Stats.module.scss'

import styles from './GenresDonut.module.scss'

// Six named slices and "other": past that, slices get too thin to tell apart
// and the palette would have to repeat a colour.
const SLICES = 6

export interface GenresDonutProps {
	genres: GenreCount[]
	total: number
	className?: string
}

export function GenresDonut({ genres, total, className }: GenresDonutProps) {
	const { t } = useTranslation()
	const theme = useChartTheme()

	const slices = useMemo(() => {
		// The badge colour (series[6]) leads the palette so the biggest slice reads
		// as the same hue as the card's icon; the rest borrow the chart series.
		const palette = [theme.series[6]!, ...theme.series.slice(0, SLICES - 1)]

		const named = genres.slice(0, SLICES).map((genre, index) => ({
			...genre,
			color: palette[index]!
		}))
		const rest = genres.slice(SLICES).reduce((sum, genre) => sum + genre.count, 0)

		return rest > 0
			? [...named, { name: t('home.stats.genres.other'), count: rest, color: theme.neutral }]
			: named
	}, [genres, theme, t])

	const percent = (count: number) => `${Math.round((count / Math.max(1, total)) * 100)}%`

	return (
		<Panel
			className={className}
			icon='common/tag'
			accent={theme.series[6]}
			title={t('home.stats.genres.title')}
			subtitle={t('home.stats.genres.subtitle')}
		>
			{slices.length === 0 ? (
				<PanelEmpty>{t('home.stats.genres.empty')}</PanelEmpty>
			) : (
				<div className={styles.donut}>
					<div className={styles.donutChart}>
						<ResponsiveContainer width='100%' height={148}>
							<PieChart>
								<Pie
									data={slices}
									dataKey='count'
									nameKey='name'
									innerRadius='70%'
									outerRadius='100%'
									paddingAngle={2}
									cornerRadius={4}
									stroke={theme.surface}
									strokeWidth={2}
									isAnimationActive={false}
								>
									{slices.map(slice => (
										<Cell key={slice.name} fill={slice.color} />
									))}
								</Pie>
								<Tooltip
									content={({ active, payload }) => {
										const slice = payload?.[0]?.payload as
											(typeof slices)[number] | undefined
										if (!active || !slice) {
											return null
										}

										return (
											<ChartTooltip
												rows={[
													{
														color: slice.color,
														label: slice.name,
														value: `${slice.count} · ${percent(slice.count)}`
													}
												]}
											/>
										)
									}}
								/>
							</PieChart>
						</ResponsiveContainer>

						<span className={styles.donutCenter}>
							<strong>{genres.length}</strong>
							{t('home.stats.genres.center', { count: genres.length })}
						</span>
					</div>

					<ul className={styles.donutLegend}>
						{slices.map(slice => (
							<li key={slice.name}>
								<span
									className={stats.swatch}
									style={{ background: slice.color }}
									aria-hidden
								/>
								<span className={styles.donutName}>{slice.name}</span>
								<span className={styles.donutShare}>{percent(slice.count)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</Panel>
	)
}
