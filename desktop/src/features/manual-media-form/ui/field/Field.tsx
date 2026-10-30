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
	// A <label> would forward clicks on its text to the first button inside, so
	// fields that hold buttons rather than one input render as a plain div.
	as?: 'label' | 'div'
	children: ReactNode
	className?: string
}

export function Field({
	label,
	hint,
	error,
	ai,
	required,
	as: Tag = 'label',
	children,
	className
}: FieldProps) {
	const { t } = useTranslation()

	return (
		<Tag className={[styles.field, className].filter(Boolean).join(' ')}>
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
		</Tag>
	)
}
