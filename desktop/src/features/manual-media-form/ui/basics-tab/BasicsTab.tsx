import { useTranslation } from '@shared/i18n'
import { Input, SelectDropdown, Stepper } from '@shared/ui'
import type { SelectDropdownOption } from '@shared/ui'

import { enumLabel } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { dateFromParts, MANUAL_FORMATS, partsFromDate } from '../../lib/draft'
import type { AiMergeField } from '../../lib/draft'
import { DatePickerField } from '../date-picker-field/DatePickerField'
import { Field } from '../field/Field'
import { TagField } from '../tag-field/TagField'

import styles from './BasicsTab.module.scss'

export interface BasicsTabProps {
	draft: ManualDraft
	onChange: (patch: Partial<ManualDraft>) => void
	aiFilled: ReadonlySet<AiMergeField>
	errors: Record<string, string>
	disabled?: boolean
}

function step(
	onChange: (patch: Partial<ManualDraft>) => void,
	field: keyof ManualDraft,
	current: number | undefined,
	delta: number
) {
	onChange({ [field]: Math.max(0, (current ?? 0) + delta) })
}

export function BasicsTab({ draft, onChange, aiFilled, errors, disabled }: BasicsTabProps) {
	const { t } = useTranslation()

	const formatOptions: SelectDropdownOption[] = MANUAL_FORMATS[draft.media_type].map(value => ({
		value,
		label: enumLabel(t, 'format', value) ?? value
	}))

	const seasonal =
		draft.media_type === 'anime' || draft.media_type === 'series' || draft.media_type === 'dorama'
	const timed = draft.media_type !== 'manga' && draft.media_type !== 'book'

	return (
		<div className={styles.root}>
			<section className={styles.section}>
				<h3 className={styles.title}>{t('manualMedia.sections.params')}</h3>

				<div className={styles.grid}>
					<Field
						label={t('manualMedia.fields.format')}
						ai={aiFilled.has('format')}
						error={errors.format}
					>
						<SelectDropdown
							options={formatOptions}
							value={draft.format ?? null}
							onChange={value =>
								onChange({ format: (value as ManualDraft['format']) ?? undefined })
							}
							placeholder={t('manualMedia.notSpecified')}
							disabled={disabled}
							clearable
						/>
					</Field>

					{timed && (
						<Field label={t('manualMedia.fields.duration')} ai={aiFilled.has('duration')}>
							<Input
								type='number'
								min={0}
								value={draft.duration ?? ''}
								onChange={event =>
									onChange({
										duration:
											event.target.value === '' ? undefined : Number(event.target.value)
									})
								}
								placeholder='—'
								disabled={disabled}
							/>
						</Field>
					)}

					{seasonal && (
						<CountStepper
							label={t('manualMedia.fields.seasons')}
							value={draft.seasons}
							ai={aiFilled.has('seasons')}
							disabled={disabled}
							onDecrement={() => step(onChange, 'seasons', draft.seasons, -1)}
							onIncrement={() => step(onChange, 'seasons', draft.seasons, 1)}
						/>
					)}

					{seasonal && (
						<CountStepper
							label={t('manualMedia.fields.episodes')}
							value={draft.episodes}
							ai={aiFilled.has('episodes')}
							disabled={disabled}
							onDecrement={() => step(onChange, 'episodes', draft.episodes, -1)}
							onIncrement={() => step(onChange, 'episodes', draft.episodes, 1)}
						/>
					)}

					{draft.media_type === 'manga' && (
						<>
							<CountStepper
								label={t('manualMedia.fields.volumes')}
								value={draft.volumes}
								ai={aiFilled.has('volumes')}
								disabled={disabled}
								onDecrement={() => step(onChange, 'volumes', draft.volumes, -1)}
								onIncrement={() => step(onChange, 'volumes', draft.volumes, 1)}
							/>

							<CountStepper
								label={t('manualMedia.fields.chapters')}
								value={draft.chapters}
								ai={aiFilled.has('chapters')}
								disabled={disabled}
								onDecrement={() => step(onChange, 'chapters', draft.chapters, -1)}
								onIncrement={() => step(onChange, 'chapters', draft.chapters, 1)}
							/>
						</>
					)}

					{draft.media_type === 'book' && (
						<CountStepper
							label={t('manualMedia.fields.pages')}
							value={draft.pages}
							ai={aiFilled.has('pages')}
							disabled={disabled}
							onDecrement={() => step(onChange, 'pages', draft.pages, -1)}
							onIncrement={() => step(onChange, 'pages', draft.pages, 1)}
						/>
					)}
				</div>
			</section>

			<section className={styles.section}>
				<h3 className={styles.title}>{t('manualMedia.sections.releaseHistory')}</h3>

				<div className={styles.grid}>
					<DatePickerField
						label={t('manualMedia.fields.startDate')}
						value={dateFromParts(draft.year, draft.start_month, draft.start_day)}
						onChange={value => {
							const parts = partsFromDate(value)
							// Clearing the date only drops its month and day; the year
							// field above keeps whatever it already had.
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
							onChange({
								end_year: parts.year,
								end_month: parts.month,
								end_day: parts.day
							})
						}}
						disabled={disabled}
					/>
				</div>

				{errors.year && <p className={styles.error}>{errors.year}</p>}
			</section>

			<section className={styles.section}>
				<Field
					as='div'
					label={t('manualMedia.fields.synonyms')}
					hint={t('manualMedia.fields.synonymsHint')}
					ai={aiFilled.has('synonyms')}
				>
					<TagField
						value={draft.synonyms ?? []}
						onChange={next => onChange({ synonyms: next })}
						placeholder={t('manualMedia.tagPlaceholder')}
						disabled={disabled}
					/>
				</Field>
			</section>
		</div>
	)
}

interface CountStepperProps {
	label: string
	value?: number
	ai?: boolean
	disabled?: boolean
	onDecrement: () => void
	onIncrement: () => void
}

function CountStepper({ label, value, ai, disabled, onDecrement, onIncrement }: CountStepperProps) {
	return (
		<Field as='div' label={label} ai={ai}>
			<div className={styles.counter}>
				<Stepper
					className={styles.stepper}
					value={String(value ?? 0)}
					onDecrement={onDecrement}
					onIncrement={onIncrement}
					disabled={disabled}
					decrementDisabled={!value}
				/>
			</div>
		</Field>
	)
}
