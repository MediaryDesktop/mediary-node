import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import stats from '../Stats.module.scss'

import styles from './Panel.module.scss'

export function iconStyle(color: string | undefined): CSSProperties | undefined {
	return color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color } : undefined
}

export interface PanelProps {
	icon: IconName
	title: string
	subtitle?: string
	action?: ReactNode
	accent?: string
	className?: string
	children: ReactNode
}

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

export function ChartTooltip({ title, rows }: { title?: string; rows: TooltipRow[] }) {
	return (
		<div className={styles.tooltip}>
			{title && <span className={styles.tooltipTitle}>{title}</span>}
			{rows.map(row => (
				<span key={row.label} className={styles.tooltipRow}>
					{row.color && <span className={stats.swatch} style={{ background: row.color }} />}
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
