import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './EmptyState.module.scss'

export type EmptyStateSize = 'page' | 'default' | 'small'

export interface EmptyStateProps {
	title?: string
	description?: string
	action?: ReactNode
	size?: EmptyStateSize
	className?: string
}

const ILLUSTRATION_WIDTH: Record<EmptyStateSize, number> = {
	page: 220,
	default: 160,
	small: 88
}

export function EmptyState({ title, description, action, size = 'default', className }: EmptyStateProps) {
	return (
		<div className={clsx(styles.root, styles[size], className)}>
			<img
				className={styles.illustration}
				src='./illustrations/empty-state.png'
				width={ILLUSTRATION_WIDTH[size]}
				alt=''
				draggable={false}
			/>

			{title && <p className={styles.title}>{title}</p>}
			{description && <p className={styles.description}>{description}</p>}
			{action && <div className={styles.action}>{action}</div>}
		</div>
	)
}
