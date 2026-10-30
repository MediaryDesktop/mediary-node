import clsx from 'clsx'
import { useRef } from 'react'
import { IoImageOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { Icon, Input, SelectDropdown, toast } from '@shared/ui'
import type { IconName, SelectDropdownOption } from '@shared/ui'

import { enumLabel } from '@entities/media'
import type { ManualDraft } from '@entities/media'

import { COMMON_COUNTRIES, flagEmoji, MANUAL_MEDIA_TYPES, MANUAL_STATUSES } from '../../lib/draft'
import type { ManualMediaType } from '../../lib/draft'
import { readImageFile } from '../../lib/read-image-file'
import { Field } from '../field/Field'
import type { CoverSelection } from '../poster-card/PosterCard'

import styles from './IdentityCard.module.scss'

const TYPE_ICONS: Record<ManualMediaType, IconName> = {
	anime: 'categories/anime',
	manga: 'categories/manga',
	movie: 'categories/movie',
	series: 'categories/series',
	dorama: 'categories/doramas',
	book: 'categories/book'
}

export interface IdentityCardProps {
	draft: ManualDraft
	onChange: (patch: Partial<ManualDraft>) => void
	coverUrl: string | null
	lockType: boolean
	// False while the draft only holds a placeholder kind: no tile is selected,
	// so nothing looks chosen that the user never chose.
	typePicked: boolean
	typeError?: string
	titleError?: string
	disabled?: boolean
	onPickCover: (selection: CoverSelection & { kind: 'data' }) => void
}

export function IdentityCard({
	draft,
	onChange,
	coverUrl,
	lockType,
	typePicked,
	typeError,
	titleError,
	disabled,
	onPickCover
}: IdentityCardProps) {
	const { t } = useTranslation()
	const picker = useRef<HTMLInputElement>(null)

	const typeOptions: SelectDropdownOption[] = MANUAL_MEDIA_TYPES.map(value => ({
		value,
		label: t(`search.type.${value}` as never),
		icon: TYPE_ICONS[value]
	}))

	const statusOptions: SelectDropdownOption[] = MANUAL_STATUSES.map(value => ({
		value,
		label: enumLabel(t, 'status', value) ?? value
	}))

	const countryOptions: SelectDropdownOption[] = COMMON_COUNTRIES.map(code => ({
		value: code,
		label: `${flagEmoji(code)} ${code}`
	}))

	const pick = async (file: File | undefined) => {
		if (!file) {
			return
		}

		try {
			const read = await readImageFile(file)
			onPickCover({
				kind: 'data',
				value: read.data,
				previewUrl: read.previewUrl,
				name: file.name,
				size: file.size
			})
		} catch {
			toast.error(t('manualMedia.cover.invalidFile'), { id: 'manual-cover-file' })
		}
	}

	return (
		<section className={styles.card}>
			<button
				type='button'
				className={clsx(styles.thumb, coverUrl && styles.filled)}
				disabled={disabled}
				aria-label={t('manualMedia.cover.add')}
				onClick={() => picker.current?.click()}
			>
				{coverUrl ? (
					<img src={coverUrl} alt='' draggable={false} />
				) : (
					<>
						<IoImageOutline size={26} />
						<span className={styles.thumbLabel}>
							{t('manualMedia.cover.add')}
							<small>{t('manualMedia.cover.addHint')}</small>
						</span>
					</>
				)}
			</button>

			<input
				ref={picker}
				type='file'
				accept='image/*'
				className={styles.filePicker}
				onChange={event => {
					void pick(event.target.files?.[0])
					event.target.value = ''
				}}
			/>

			<div className={styles.fields}>
				<div className={styles.titleRow}>
					<Field label={t('manualMedia.type')} required>
						<SelectDropdown
							options={typeOptions}
							value={typePicked ? draft.media_type : null}
							onChange={value =>
								!lockType && value && onChange({ media_type: value as ManualMediaType })
							}
							placeholder={t('manualMedia.typePlaceholder')}
							error={typeError}
							disabled={disabled || lockType}
							accentWhenSelected
						/>
					</Field>

					<Field label={t('manualMedia.fields.title')} required>
						<Input
							className={styles.titleInput}
							value={draft.title}
							onChange={event => onChange({ title: event.target.value })}
							placeholder={t('manualMedia.fields.titlePlaceholder')}
							error={titleError}
							disabled={disabled}
							maxLength={300}
						/>
					</Field>
				</div>

				<Field label={t('manualMedia.fields.originalTitle')}>
					<Input
						value={draft.original_title ?? ''}
						onChange={event => onChange({ original_title: event.target.value })}
						placeholder={t('manualMedia.fields.originalTitlePlaceholder')}
						disabled={disabled}
						maxLength={300}
					/>
				</Field>

				<div className={styles.row}>
					<Field label={t('manualMedia.fields.year')}>
						<Input
							type='number'
							min={1800}
							max={2100}
							value={draft.year ?? ''}
							onChange={event =>
								onChange({
									year: event.target.value === '' ? undefined : Number(event.target.value)
								})
							}
							placeholder='—'
							disabled={disabled}
						/>
					</Field>

					<Field label={t('manualMedia.fields.country')}>
						<SelectDropdown
							options={countryOptions}
							value={draft.country_of_origin ?? null}
							onChange={value => onChange({ country_of_origin: value ?? undefined })}
							placeholder={t('manualMedia.notSpecified')}
							clearable
							searchable
							disabled={disabled}
						/>
					</Field>

					<Field label={t('manualMedia.fields.status')}>
						<SelectDropdown
							options={statusOptions}
							value={draft.status ?? null}
							onChange={value =>
								onChange({ status: (value as ManualDraft['status']) ?? undefined })
							}
							placeholder={t('manualMedia.notSpecified')}
							clearable
							disabled={disabled}
						/>
					</Field>
				</div>

				{lockType && (
					<span className={styles.lockHint}>
						<Icon name='common/lock' size={13} />
						{t('manualMedia.typeLocked')}
					</span>
				)}
			</div>
		</section>
	)
}
