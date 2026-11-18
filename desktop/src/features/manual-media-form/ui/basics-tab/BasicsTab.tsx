import { useTranslation } from '@shared/i18n'
import { Input, Stepper } from '@shared/ui'

import { isReadMedia } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { Field } from '../field/Field'

import styles from './BasicsTab.module.scss'

export interface BasicsTabProps {
	draft: ManualDraft
	onChange: (patch: Partial<ManualDraft>) => void
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

export function BasicsTab({ draft, onChange, disabled }: BasicsTabProps) {
	const { t } = useTranslation()

	const seasonal =
		draft.media_type === 'anime' || draft.media_type === 'series' || draft.media_type === 'dorama'
	const timed = !isReadMedia(draft.media_type)

	return (
		<div className={styles.grid}>
			{timed && (
				<Field label={t('manualMedia.fields.duration')}>
					<Input
						type='number'
						min={0}
						value={draft.duration ?? ''}
						onChange={event =>
							onChange({
								duration: event.target.value === '' ? undefined : Number(event.target.value)
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
					disabled={disabled}
					onDecrement={() => step(onChange, 'seasons', draft.seasons, -1)}
					onIncrement={() => step(onChange, 'seasons', draft.seasons, 1)}
				/>
			)}

			{seasonal && (
				<CountStepper
					label={t('manualMedia.fields.episodes')}
					value={draft.episodes}
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
						disabled={disabled}
						onDecrement={() => step(onChange, 'volumes', draft.volumes, -1)}
						onIncrement={() => step(onChange, 'volumes', draft.volumes, 1)}
					/>

					<CountStepper
						label={t('manualMedia.fields.chapters')}
						value={draft.chapters}
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
					disabled={disabled}
					onDecrement={() => step(onChange, 'pages', draft.pages, -1)}
					onIncrement={() => step(onChange, 'pages', draft.pages, 1)}
				/>
			)}
		</div>
	)
}

interface CountStepperProps {
	label: string
	value?: number
	disabled?: boolean
	onDecrement: () => void
	onIncrement: () => void
}

function CountStepper({ label, value, disabled, onDecrement, onIncrement }: CountStepperProps) {
	return (
		<Field as='div' label={label}>
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
