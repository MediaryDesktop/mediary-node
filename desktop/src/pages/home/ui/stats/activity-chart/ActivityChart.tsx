import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useTranslation } from '@shared/i18n'
import { SegmentedControl } from '@shared/ui'

import type { TrackerEntry } from '@entities/tracker'

import { useChartTheme } from '../../../config/chart-theme'
import { activity } from '../../../lib/stats'
import type { ActivityRange } from '../../../lib/stats'
import { ChartTooltip, Panel, PanelEmpty } from '../panel/Panel'
import styles from '../Stats.module.scss'

const RANGES: readonly ActivityRange[] = ['6m', '1y', 'all']

export interface ActivityChartProps {
	entries: TrackerEntry[]
	className?: string
}

export function ActivityChart({ entries, className }: ActivityChartProps) {
	const { t, i18n } = useTranslation()
	const theme = useChartTheme()
	const gradient = useId().replace(/:/g, '')
	const [range, setRange] = useState<ActivityRange>('6m')

	const started = theme.statusColor.CURRENT
	const completed = theme.statusColor.COMPLETED

	const data = useMemo(() => {
		const month = new Intl.DateTimeFormat(i18n.language, { month: 'short' })
		const full = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' })

		return activity(entries, range).map(point => ({
			...point,
			label:
				point.month === null
					? String(point.year)
					: month.format(new Date(point.year, point.month - 1)),
			title:
				point.month === null ? String(point.year) : full.format(new Date(point.year, point.month - 1))
		}))
	}, [entries, range, i18n.language])

	const totals = data.reduce(
		(sum, point) => ({
			started: sum.started + point.started,
			completed: sum.completed + point.completed
		}),
		{ started: 0, completed: 0 }
	)

	const series = [
		{
			key: 'started' as const,
			color: started,
			label: t('home.stats.activity.started'),
			total: totals.started
		},
		{
			key: 'completed' as const,
			color: completed,
			label: t('home.stats.activity.completed'),
			total: totals.completed
		}
	]

	return (
		<Panel
			className={className}
			icon='common/calendar'
			accent={started}
			title={t('home.stats.activity.title')}
			subtitle={t('home.stats.activity.subtitle')}
			action={
				<SegmentedControl
					items={RANGES.map(value => ({ value, label: t(`home.stats.activity.range.${value}`) }))}
					value={range}
					onValueChange={setRange}
					label={t('home.stats.activity.title')}
				/>
			}
		>
			<ul className={styles.legend}>
				{series.map(item => (
					<li key={item.key} className={styles.legendItem}>
						<span className={styles.swatch} style={{ background: item.color }} aria-hidden />
						{item.label}
						<span className={styles.legendCount}>{item.total}</span>
					</li>
				))}
			</ul>

			{totals.started + totals.completed === 0 ? (
				<PanelEmpty>{t('home.stats.activity.empty')}</PanelEmpty>
			) : (
				<div className={styles.chartArea}>
					<ResponsiveContainer width='100%' height={240}>
						<AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
							<defs>
								{series.map(item => (
									<linearGradient
										key={item.key}
										id={`${gradient}-${item.key}`}
										x1='0'
										y1='0'
										x2='0'
										y2='1'
									>
										<stop offset='0%' stopColor={item.color} stopOpacity={0.32} />
										<stop offset='100%' stopColor={item.color} stopOpacity={0} />
									</linearGradient>
								))}
							</defs>

							<CartesianGrid vertical={false} stroke={theme.grid} strokeDasharray='0' />
							<XAxis
								dataKey='label'
								tickLine={false}
								axisLine={false}
								tick={{ fill: theme.axis, fontSize: 12 }}
								tickMargin={10}
							/>
							<YAxis
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								tick={{ fill: theme.axis, fontSize: 12 }}
								width={40}
							/>

							<Tooltip
								cursor={{ stroke: theme.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
								content={({ active, payload }) => {
									const point = payload?.[0]?.payload as (typeof data)[number] | undefined
									if (!active || !point) {
										return null
									}

									return (
										<ChartTooltip
											title={point.title}
											rows={series.map(item => ({
												color: item.color,
												label: item.label,
												value: String(point[item.key])
											}))}
										/>
									)
								}}
							/>

							{series.map(item => (
								<Area
									key={item.key}
									type='monotone'
									dataKey={item.key}
									stroke={item.color}
									strokeWidth={2}
									fill={`url(#${gradient}-${item.key})`}
									dot={false}
									activeDot={{
										r: 5,
										strokeWidth: 2,
										stroke: theme.surface,
										fill: item.color
									}}
									isAnimationActive={false}
								/>
							))}
						</AreaChart>
					</ResponsiveContainer>
				</div>
			)}
		</Panel>
	)
}
