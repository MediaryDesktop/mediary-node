import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'

import { useTranslation } from '@shared/i18n'
import {
	Button,
	Drawer,
	DrawerForm,
	DrawerSection,
	Icon,
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
import type { ManualMediaField } from '../../lib/draft'
import { manualMediaModel } from '../../model/model'

import { ManualField } from './manual-field/ManualField'
import styles from './ManualMediaDrawer.module.scss'

export function ManualMediaDrawer() {
	const { t, i18n } = useTranslation()
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

	const [suggested, suggesting, canSuggest, suggestRequested] = useUnit([
		manualMediaModel.$suggested,
		manualMediaModel.$suggesting,
		manualMediaModel.$canSuggest,
		manualMediaModel.suggestRequested
	])

	const badge = (field: ManualMediaField) =>
		suggested.includes(field) ? t('manualMedia.ai.suggested') : undefined

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

				<DrawerSection
					title={t('manualMedia.sections.name')}
					description={t('manualMedia.ai.hint')}
					action={
						<Button
							variant='secondary'
							size='small'
							startIcon={<Icon name='common/sparkles' size={16} />}
							disabled={!canSuggest}
							loading={suggesting}
							onClick={() => suggestRequested(i18n.language)}
						>
							{t('manualMedia.ai.fill')}
						</Button>
					}
				>
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

						<ManualField
							label={t('manualMedia.fields.originalTitle')}
							badge={badge('originalTitle')}
							wide
						>
							<Input
								value={form.originalTitle}
								onChange={event => fieldsChanged({ originalTitle: event.target.value })}
								disabled={submitting}
								autoComplete='off'
								maxLength={300}
							/>
						</ManualField>

						<ManualField label={t('manualMedia.fields.synonyms')} badge={badge('synonyms')} wide>
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
						<ManualField label={t('manualMedia.fields.year')} badge={badge('year')}>
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

						<ManualField label={t('manualMedia.fields.status')} badge={badge('status')}>
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
							<ManualField label={t('manualMedia.fields.format')} badge={badge('format')} wide>
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
							<ManualField
								key={field}
								label={t(`manualMedia.fields.${field}`)}
								badge={badge(field)}
							>
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
						<ManualField label={t('manualMedia.fields.genres')} badge={badge('genres')} wide>
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
							badge={badge(writers ? 'authors' : 'studios')}
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

						<ManualField
							label={t('manualMedia.fields.description')}
							badge={badge('description')}
							wide
						>
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
