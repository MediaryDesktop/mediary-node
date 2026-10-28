import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'

import { useTranslation } from '@shared/i18n'
import {
	Drawer,
	DrawerForm,
	DrawerSection,
	Input,
	SelectDropdown,
	SelectionGroup,
	Textarea
} from '@shared/ui'

import { enumLabel } from '@entities/media'
import type { ManualMediaFormat, ManualMediaStatus } from '@entities/media'
import { MediaTypeIcon } from '@entities/tracker'

import {
	hasAuthors,
	MANUAL_COUNTS,
	MANUAL_FORMATS,
	MANUAL_MEDIA_TYPES,
	MANUAL_STATUSES
} from '../../lib/draft'
import { manualMediaModel } from '../../model/model'

import { ManualField } from './manual-field/ManualField'
import styles from './ManualMediaDrawer.module.scss'

export function ManualMediaDrawer() {
	const { t } = useTranslation()
	const titleRef = useRef<HTMLInputElement>(null)

	const [
		open,
		form,
		errors,
		editingRef,
		canSubmit,
		submitting,
		close,
		fieldsChanged,
		mediaTypeChanged,
		submitted
	] = useUnit([
		manualMediaModel.$open,
		manualMediaModel.$form,
		manualMediaModel.$errors,
		manualMediaModel.$editingRef,
		manualMediaModel.$canSubmit,
		manualMediaModel.$submitting,
		manualMediaModel.drawerClosed,
		manualMediaModel.fieldsChanged,
		manualMediaModel.mediaTypeChanged,
		manualMediaModel.submitted
	])

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => titleRef.current?.focus())
		}
	}, [open])

	const editing = editingRef !== null
	const formats = MANUAL_FORMATS[form.mediaType]
	const writers = hasAuthors(form.mediaType)

	const typeOptions = MANUAL_MEDIA_TYPES.map(type => ({
		value: type,
		label: t(`manualMedia.type.${type}`),
		icon: <MediaTypeIcon type={type} size={20} />
	}))

	const formatOptions = formats.map(format => ({
		value: format,
		label: enumLabel(t, 'format', format) ?? format
	}))
	const statusOptions = MANUAL_STATUSES.map(status => ({
		value: status,
		label: enumLabel(t, 'status', status) ?? status
	}))

	const errorText = (field: keyof typeof errors) => {
		const error = errors[field]
		return error ? t(`manualMedia.errors.${error}`) : undefined
	}

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={editing ? t('manualMedia.editTitle') : t('manualMedia.createTitle')}
			description={editing ? undefined : t('manualMedia.createSubtitle')}
			closable={false}
			size='md'
		>
			<DrawerForm
				onSubmit={submitted}
				onCancel={close}
				submitLabel={editing ? t('manualMedia.save') : t('manualMedia.create')}
				submitDisabled={!canSubmit}
				cancelDisabled={submitting}
				submitting={submitting}
			>
				<DrawerSection
					title={t('manualMedia.sections.kind')}
					description={editing ? t('manualMedia.sections.kindLocked') : undefined}
				>
					<SelectionGroup
						options={typeOptions}
						value={form.mediaType}
						onValueChange={mediaTypeChanged}
						label={t('manualMedia.sections.kind')}
						disabled={submitting || editing}
						stretch
					/>
				</DrawerSection>

				<DrawerSection title={t('manualMedia.sections.name')}>
					<div className={styles.grid}>
						<ManualField label={t('manualMedia.fields.title')} wide>
							<Input
								ref={titleRef}
								value={form.title}
								onChange={event => fieldsChanged({ title: event.target.value })}
								disabled={submitting}
								autoComplete='off'
								maxLength={300}
								placeholder={t('manualMedia.fields.titlePlaceholder')}
							/>
						</ManualField>

						<ManualField label={t('manualMedia.fields.originalTitle')} wide>
							<Input
								value={form.originalTitle}
								onChange={event => fieldsChanged({ originalTitle: event.target.value })}
								disabled={submitting}
								autoComplete='off'
								maxLength={300}
							/>
						</ManualField>

						<ManualField label={t('manualMedia.fields.synonyms')} wide>
							<Textarea
								value={form.synonyms}
								onChange={event => fieldsChanged({ synonyms: event.target.value })}
								disabled={submitting}
								rows={2}
								placeholder={t('manualMedia.fields.synonymsPlaceholder')}
							/>
						</ManualField>
					</div>
				</DrawerSection>

				<DrawerSection title={t('manualMedia.sections.release')}>
					<div className={styles.grid}>
						<ManualField label={t('manualMedia.fields.year')}>
							<Input
								value={form.year}
								onChange={event => fieldsChanged({ year: event.target.value })}
								disabled={submitting}
								inputMode='numeric'
								autoComplete='off'
								maxLength={4}
								error={errorText('year')}
							/>
						</ManualField>

						<ManualField label={t('manualMedia.fields.status')}>
							<SelectDropdown
								options={statusOptions}
								value={form.status}
								onChange={value =>
									fieldsChanged({ status: value as ManualMediaStatus | null })
								}
								placeholder={t('manualMedia.fields.statusNone')}
								disabled={submitting}
								clearable
							/>
						</ManualField>

						{formats.length > 1 && (
							<ManualField label={t('manualMedia.fields.format')} wide>
								<SelectDropdown
									options={formatOptions}
									value={form.format}
									onChange={value =>
										fieldsChanged({ format: value as ManualMediaFormat | null })
									}
									placeholder={enumLabel(t, 'format', formats[0]) ?? undefined}
									disabled={submitting}
									clearable
								/>
							</ManualField>
						)}

						{MANUAL_COUNTS[form.mediaType].map(field => (
							<ManualField key={field} label={t(`manualMedia.fields.${field}`)}>
								<Input
									value={form[field]}
									onChange={event => fieldsChanged({ [field]: event.target.value })}
									disabled={submitting}
									inputMode='numeric'
									autoComplete='off'
									maxLength={6}
									error={errorText(field)}
								/>
							</ManualField>
						))}
					</div>
				</DrawerSection>

				<DrawerSection title={t('manualMedia.sections.about')}>
					<div className={styles.grid}>
						<ManualField label={t('manualMedia.fields.genres')} wide>
							<Input
								value={form.genres}
								onChange={event => fieldsChanged({ genres: event.target.value })}
								disabled={submitting}
								autoComplete='off'
								placeholder={t('manualMedia.fields.listPlaceholder')}
							/>
						</ManualField>

						<ManualField
							label={
								writers ? t('manualMedia.fields.authors') : t('manualMedia.fields.studios')
							}
							wide
						>
							<Input
								value={writers ? form.authors : form.studios}
								onChange={event =>
									fieldsChanged(
										writers
											? { authors: event.target.value }
											: { studios: event.target.value }
									)
								}
								disabled={submitting}
								autoComplete='off'
								placeholder={t('manualMedia.fields.listPlaceholder')}
							/>
						</ManualField>

						<ManualField label={t('manualMedia.fields.description')} wide>
							<Textarea
								value={form.description}
								onChange={event => fieldsChanged({ description: event.target.value })}
								disabled={submitting}
								rows={5}
								maxLength={10000}
							/>
						</ManualField>
					</div>
				</DrawerSection>
			</DrawerForm>
		</Drawer>
	)
}
