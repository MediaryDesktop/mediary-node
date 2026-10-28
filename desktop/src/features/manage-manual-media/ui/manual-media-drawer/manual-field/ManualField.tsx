import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './ManualField.module.scss'

export interface ManualFieldProps {
	label: string
	wide?: boolean
	children: ReactNode
}

export function ManualField({ label, wide = false, children }: ManualFieldProps) {
	return (
		<label className={clsx(styles.field, wide && styles.wide)}>
			<span className={styles.label}>{label}</span>
			{children}
		</label>
	)
}
