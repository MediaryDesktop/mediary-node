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

// Built on details and summary: the browser already knows how to open, close and
// announce one, and a log nobody opens should cost nothing to render.
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
