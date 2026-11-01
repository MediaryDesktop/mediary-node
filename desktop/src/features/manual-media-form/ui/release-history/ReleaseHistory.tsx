import { useTranslation } from '@shared/i18n'

import type { ManualDraft } from '@entities/media'

import { dateFromParts, partsFromDate } from '../../lib/draft'
import type { AiMergeField } from '../../lib/draft'
import { DatePickerField } from '../date-picker-field/DatePickerField'

import styles from './ReleaseHistory.module.scss'

export interface ReleaseHistoryProps {
	draft: ManualDraft
	onChange: (patch: Partial<ManualDraft>) => void
	aiFilled: ReadonlySet<AiMergeField>
	error?: string
	disabled?: boolean
}

export function ReleaseHistory({ draft, onChange, aiFilled, error, disabled }: ReleaseHistoryProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<div className={styles.grid}>
				<DatePickerField
					label={t('manualMedia.fields.startDate')}
					value={dateFromParts(draft.year, draft.start_month, draft.start_day)}
					onChange={value => {
						const parts = partsFromDate(value)
						// Clearing the date only drops its month and day; the year the
						// basics card holds keeps whatever it already had.
						onChange({
							year: parts.year ?? draft.year,
							start_month: parts.month,
							start_day: parts.day
						})
					}}
					disabled={disabled}
				/>

				<DatePickerField
					label={t('manualMedia.fields.endDate')}
					value={dateFromParts(draft.end_year, draft.end_month, draft.end_day)}
					ai={aiFilled.has('end_year')}
					onChange={value => {
						const parts = partsFromDate(value)
						onChange({ end_year: parts.year, end_month: parts.month, end_day: parts.day })
					}}
					disabled={disabled}
				/>
			</div>

			{error && <p className={styles.error}>{error}</p>}
		</div>
	)
}
