import clsx from 'clsx'
import type { ReactNode } from 'react'

import { renderIcon } from '../icon/Icon'
import type { IconLike } from '../icon/Icon'

import styles from './Badge.module.scss'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps {
	tone?: BadgeTone
	icon?: IconLike
	children: ReactNode
	className?: string
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
	return (
		<span className={clsx(styles.badge, styles[tone], className)}>
			{icon && renderIcon(icon, 14)}
			{children}
		</span>
	)
}
