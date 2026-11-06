import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '../icon/Icon'

import styles from './Disclosure.module.scss'

export interface DisclosureProps {
	summary: ReactNode
	children: ReactNode
	defaultOpen?: boolean
	className?: string
}

export function Disclosure({ summary, children, defaultOpen, className }: DisclosureProps) {
	return (
		<details className={clsx(styles.disclosure, className)} open={defaultOpen}>
			<summary className={styles.summary}>
				<span className={styles.label}>{summary}</span>
				<Icon name='common/chevron-down' size={16} className={styles.chevron} />
			</summary>

			<div className={styles.content}>{children}</div>
		</details>
	)
}
