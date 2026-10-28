import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './ManualField.module.scss'

export interface ManualFieldProps {
	label: string
	wide?: boolean
	badge?: string
	children: ReactNode
}

export function ManualField({ label, wide = false, badge, children }: ManualFieldProps) {
	return (
		<label className={clsx(styles.field, wide && styles.wide, badge && styles.suggested)}>
			<span className={styles.label}>
				{label}
				{badge && <span className={styles.badge}>{badge}</span>}
			</span>
			{children}
		</label>
	)
}
