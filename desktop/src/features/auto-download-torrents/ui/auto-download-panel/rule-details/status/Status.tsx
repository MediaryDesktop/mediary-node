import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import styles from './Status.module.scss'

export interface StatusProps {
	tone: 'success' | 'info' | 'danger' | 'neutral'
	icon: IconName
	title: string
	children?: ReactNode
}

export function Status({ tone, icon, title, children }: StatusProps) {
	return (
		<div className={clsx(styles.status, styles[tone])}>
			<span className={styles.icon}>
				<Icon name={icon} size={16} />
			</span>
			<div className={styles.body}>
				<p className={styles.title}>{title}</p>
				{children}
			</div>
		</div>
	)
}
