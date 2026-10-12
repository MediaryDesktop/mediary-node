import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

import { useTranslation } from '@shared/i18n'

import { useChartTheme } from '../../../config/chart-theme'
import type { ScoreBucket } from '../../../lib/stats'
import { ChartTooltip, Panel, PanelEmpty } from '../panel/Panel'
import styles from '../Stats.module.scss'

export interface ScoresChartProps {
	scores: ScoreBucket[]
	mean: number | null
	scored: number
	className?: string
}

// How the user scores, on the ten-point scale: one bar per score, the most
// common one in colour so the habit reads at a glance.
export function ScoresChart({ scores, mean, scored, className }: ScoresChartProps) {
	const { t } = useTranslation()
	const theme = useChartTheme()

	const top = Math.max(...scores.map(bucket => bucket.count))
	const accent = theme.series[3]

	return (
		<Panel
			className={className}
			icon='common/star'
			accent={accent}
			title={t('home.stats.scores.title')}
			subtitle={t('home.stats.scores.subtitle', { count: scored })}
		>
			{mean === null ? (
				<PanelEmpty>{t('home.stats.scores.empty')}</PanelEmpty>
			) : (
				<div className={styles.chartArea} style={{ marginTop: 'auto' }}>
					<ResponsiveContainer width='100%' height={150}>
						<BarChart
							data={scores}
							margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
							barCategoryGap='18%'
						>
							<XAxis
								dataKey='score'
								tickLine={false}
								axisLine={false}
								tick={{ fill: theme.axis, fontSize: 12 }}
								tickMargin={8}
							/>
							<Tooltip
								cursor={false}
								content={({ active, payload }) => {
									const bucket = payload?.[0]?.payload as ScoreBucket | undefined
									if (!active || !bucket) {
										return null
									}

									return (
										<ChartTooltip
											title={t('home.stats.scores.bucket', { score: bucket.score })}
											rows={[
												{
													label: t('home.stats.scores.titles'),
													value: String(bucket.count)
												}
											]}
										/>
									)
								}}
							/>
							<Bar
								dataKey='count'
								radius={[6, 6, 6, 6]}
								minPointSize={4}
								isAnimationActive={false}
							>
								{scores.map(bucket => (
									<Cell
										key={bucket.score}
										fill={bucket.count === top && top > 0 ? accent : theme.neutral}
									/>
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</Panel>
	)
}
