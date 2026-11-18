import { useTranslation } from '@shared/i18n'
import { Checkbox } from '@shared/ui'

import { isReadMedia } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { Field } from '../field/Field'
import { TagField } from '../tag-field/TagField'

import styles from './DetailsTab.module.scss'

export interface DetailsTabProps {
	draft: ManualDraft
	onChange: (patch: Partial<ManualDraft>) => void
	disabled?: boolean
}

export function DetailsTab({ draft, onChange, disabled }: DetailsTabProps) {
	const { t } = useTranslation()
	const bookish = isReadMedia(draft.media_type)

	return (
		<div className={styles.root}>
			<Field
				as='div'
				label={bookish ? t('manualMedia.fields.authors') : t('manualMedia.fields.studios')}
			>
				<TagField
					value={(bookish ? draft.authors : draft.studios) ?? []}
					onChange={next => onChange(bookish ? { authors: next } : { studios: next })}
					placeholder={t('manualMedia.tagPlaceholder')}
					disabled={disabled}
				/>
			</Field>

			<Field
				as='div'
				label={t('manualMedia.fields.synonyms')}
				hint={t('manualMedia.fields.synonymsHint')}
			>
				<TagField
					value={draft.synonyms ?? []}
					onChange={next => onChange({ synonyms: next })}
					placeholder={t('manualMedia.tagPlaceholder')}
					disabled={disabled}
				/>
			</Field>

			<label className={styles.adultRow}>
				<Checkbox
					checked={draft.is_adult ?? false}
					onCheckedChange={checked => onChange({ is_adult: checked })}
					label={t('manualMedia.fields.isAdult')}
					disabled={disabled}
				/>
				<span>{t('manualMedia.fields.isAdult')}</span>
			</label>
		</div>
	)
}
