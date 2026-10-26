import clsx from 'clsx'
import type { ReactNode } from 'react'

import { renderIcon } from '../icon/Icon'
import type { IconLike } from '../icon/Icon'

import styles from './Badge.module.scss'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
	tone?: BadgeTone
	size?: BadgeSize
	icon?: IconLike
	children: ReactNode
	className?: string
}

const ICON_SIZE: Record<BadgeSize, number> = { sm: 14, md: 16 }

export function Badge({ tone = 'neutral', size = 'sm', icon, children, className }: BadgeProps) {
	return (
		<span className={clsx(styles.badge, styles[tone], styles[size], className)}>
			{icon && renderIcon(icon, ICON_SIZE[size])}
			{children}
		</span>
	)
}
