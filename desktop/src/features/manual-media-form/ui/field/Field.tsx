import type { ReactNode } from 'react'

import styles from './Field.module.scss'

export interface FieldProps {
	label: string
	hint?: string
	error?: string
	required?: boolean
	as?: 'label' | 'div'
	children: ReactNode
	className?: string
}

export function Field({ label, hint, error, required, as: Tag = 'label', children, className }: FieldProps) {
	return (
		<Tag className={[styles.field, className].filter(Boolean).join(' ')}>
			<span className={styles.labelRow}>
				<span className={styles.label}>
					{label}
					{required && <span className={styles.required}>*</span>}
				</span>
			</span>

			{children}

			{hint && !error && <span className={styles.hint}>{hint}</span>}
			{error && <span className={styles.error}>{error}</span>}
		</Tag>
	)
}
