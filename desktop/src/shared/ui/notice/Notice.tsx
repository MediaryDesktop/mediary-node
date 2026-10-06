import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '../icon/Icon'

import styles from './Notice.module.scss'

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success'

export interface NoticeProps {
	tone?: NoticeTone
	title?: ReactNode
	children?: ReactNode
	action?: ReactNode
	className?: string
}

export function Notice({ tone = 'info', title, children, action, className }: NoticeProps) {
	return (
		<div
			className={clsx(styles.notice, styles[tone], className)}
			role={tone === 'danger' ? 'alert' : 'status'}
		>
			<span className={styles.icon}>
				<Icon name='common/info' size={18} />
			</span>

			<div className={styles.body}>
				{title != null && <p className={styles.title}>{title}</p>}
				{children != null && <div className={styles.text}>{children}</div>}
			</div>

			{action != null && <div className={styles.action}>{action}</div>}
		</div>
	)
}
