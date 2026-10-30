import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge } from '@shared/ui'

import styles from './Field.module.scss'

export interface FieldProps {
	label: string
	hint?: string
	error?: string
	ai?: boolean
	required?: boolean
	children: ReactNode
	className?: string
}

export function Field({ label, hint, error, ai, required, children, className }: FieldProps) {
	const { t } = useTranslation()

	return (
		<label className={[styles.field, className].filter(Boolean).join(' ')}>
			<span className={styles.labelRow}>
				<span className={styles.label}>
					{label}
					{required && <span className={styles.required}>*</span>}
				</span>

				{ai && (
					<Badge tone='accent' size='sm'>
						{t('manualMedia.ai.filledBadge')}
					</Badge>
				)}
			</span>

			{children}

			{hint && !error && <span className={styles.hint}>{hint}</span>}
			{error && <span className={styles.error}>{error}</span>}
		</label>
	)
}
