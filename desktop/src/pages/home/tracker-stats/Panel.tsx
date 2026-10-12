import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import styles from './Stats.module.scss'

// A muted badge in the given colour, the same 16% wash as --accent-muted but in
// whichever hue the card was handed — undefined lets the CSS default (the accent)
// stand.
export function iconStyle(color: string | undefined): CSSProperties | undefined {
	return color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color } : undefined
}

export interface PanelProps {
	icon: IconName
	title: string
	subtitle?: string
	action?: ReactNode
	// A series colour from useChartTheme, so each card reads as its own thing
	// rather than all sharing the accent. Falls back to the accent when absent.
	accent?: string
	className?: string
	children: ReactNode
}

// One card of the statistics: what it shows, why, and the chart itself.
export function Panel({ icon, title, subtitle, action, accent, className, children }: PanelProps) {
	return (
		<section
			className={clsx(styles.panel, className)}
			style={accent ? ({ '--tile-accent': accent } as CSSProperties) : undefined}
			aria-label={title}
		>
			<header className={styles.panelHead}>
				<span className={styles.panelIcon} style={iconStyle(accent)} aria-hidden>
					<Icon name={icon} size={22} />
				</span>
				<span className={styles.panelText}>
					<h3 className={styles.panelTitle}>{title}</h3>
					{subtitle && <span className={styles.panelSubtitle}>{subtitle}</span>}
				</span>
				{action && <span className={styles.panelAction}>{action}</span>}
			</header>

			{children}
		</section>
	)
}

export interface TooltipRow {
	color?: string
	label: string
	value: string
}

// The hover card every chart shares: a heading and one row per series.
export function ChartTooltip({ title, rows }: { title?: string; rows: TooltipRow[] }) {
	return (
		<div className={styles.tooltip}>
			{title && <span className={styles.tooltipTitle}>{title}</span>}
			{rows.map(row => (
				<span key={row.label} className={styles.tooltipRow}>
					{row.color && <span className={styles.swatch} style={{ background: row.color }} />}
					<span className={styles.tooltipLabel}>{row.label}</span>
					<span className={styles.tooltipValue}>{row.value}</span>
				</span>
			))}
		</div>
	)
}

export function PanelEmpty({ children }: { children: ReactNode }) {
	return <p className={styles.panelEmpty}>{children}</p>
}
