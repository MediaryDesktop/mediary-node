import { useMemo } from 'react'

import { useSurfaceTheme } from '@shared/style/theme'
import type { Theme } from '@shared/style/theme'

import type { TrackerStatus } from '@entities/tracker'

const SERIES: Record<Theme, readonly string[]> = {
	light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'],
	dark: ['#4197ff', '#ff7640', '#3bffba', '#ffbf3e', '#ff4b8d', '#44ff44', '#7968ff']
}

const STATUS_COLOR: Record<Theme, Record<TrackerStatus, string>> = {
	light: {
		COMPLETED: '#0ca30c',
		CURRENT: '#2a78d6',
		REPEATING: '#4a3aa7',
		PLANNING: '#a84fb0',
		PAUSED: '#fab219',
		DROPPED: '#d03b3b'
	},
	dark: {
		COMPLETED: '#5bff5b',
		CURRENT: '#43caffd6',
		REPEATING: '#966ff8',
		PLANNING: '#db4dff',
		PAUSED: '#fffc50',
		DROPPED: '#fb4343'
	}
}

export interface ChartTheme {
	series: readonly string[]
	statusColor: Record<TrackerStatus, string>
	neutral: string
	grid: string
	axis: string
	surface: string
}

export function useChartTheme(): ChartTheme {
	const theme = useSurfaceTheme()

	return useMemo(() => {
		const css = getComputedStyle(document.documentElement)
		const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback

		return {
			series: SERIES[theme],
			statusColor: STATUS_COLOR[theme],
			neutral: token('--surface-muted', theme === 'dark' ? '#4a4a4a' : '#cecece'),
			grid: token('--border', theme === 'dark' ? '#2e2e2e' : '#cecece'),
			axis: token('--text-muted', '#8a8a8a'),
			surface: token('--surface', theme === 'dark' ? '#212121' : '#f2f2f2')
		}
	}, [theme])
}
