import { useTranslation } from '@shared/i18n'
import { Badge, DatePicker } from '@shared/ui'

import styles from './DatePickerField.module.scss'

export interface DatePickerFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	ai?: boolean
	disabled?: boolean
}

// The month and day behind a count that otherwise only knows its year — kept
// apart from Year itself, which the identity card always shows on its own.
// DatePicker's own clear button already empties this back out.
export function DatePickerField({ label, value, onChange, ai, disabled }: DatePickerFieldProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.field}>
			<span className={styles.labelRow}>
				<span className={styles.label}>{label}</span>

				{ai && (
					<Badge tone='accent' size='sm'>
						{t('manualMedia.ai.filledBadge')}
					</Badge>
				)}
			</span>

			<DatePicker value={value} onChange={onChange} disabled={disabled} />
		</div>
	)
}
