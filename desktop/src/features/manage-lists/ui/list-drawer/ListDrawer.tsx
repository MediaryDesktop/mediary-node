import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'

import { useTranslation } from '@shared/i18n'
import { Drawer, DrawerForm, DrawerSection, Input, SelectionGroup } from '@shared/ui'

import { LIST_MEDIA_TYPES, MediaTypeIcon } from '@entities/tracker'

import { manageListsModel } from '../../model/model'

import { IconPicker } from './icon-picker/IconPicker'

export function ListDrawer() {
	const { t } = useTranslation()
	const nameRef = useRef<HTMLInputElement>(null)

	const [
		open,
		name,
		mediaType,
		icon,
		editingID,
		canSubmit,
		submitting,
		close,
		nameChanged,
		mediaTypeChanged,
		iconChanged,
		submitted
	] = useUnit([
		manageListsModel.$open,
		manageListsModel.$name,
		manageListsModel.$mediaType,
		manageListsModel.$icon,
		manageListsModel.$editingID,
		manageListsModel.$canSubmit,
		manageListsModel.$submitting,
		manageListsModel.drawerClosed,
		manageListsModel.nameChanged,
		manageListsModel.mediaTypeChanged,
		manageListsModel.iconChanged,
		manageListsModel.submitted
	])

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => nameRef.current?.select())
		}
	}, [open])

	const renaming = editingID !== null
	const tracked = mediaType === 'anime' || mediaType === 'manga'

	const typeOptions = LIST_MEDIA_TYPES.map(type => ({
		value: type,
		label: t(`lists.mediaType.${type}`),
		icon: <MediaTypeIcon type={type} size={20} />
	}))

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={renaming ? t('lists.manage.renameTitle') : t('lists.manage.createTitle')}
			description={renaming ? undefined : t('lists.manage.createSubtitle')}
			closable={false}
		>
			<DrawerForm
				onSubmit={submitted}
				onCancel={close}
				submitLabel={renaming ? t('lists.manage.save') : t('lists.manage.create')}
				submitDisabled={!canSubmit}
				cancelDisabled={submitting}
				submitting={submitting}
			>
				<DrawerSection title={t('lists.manage.nameLabel')} description={t('lists.manage.nameHint')}>
					<Input
						ref={nameRef}
						value={name}
						onChange={event => nameChanged(event.target.value)}
						disabled={submitting}
						autoComplete='off'
						maxLength={100}
						placeholder={t('lists.manage.namePlaceholder')}
					/>
				</DrawerSection>

				<DrawerSection title={t('lists.manage.iconLabel')} description={t('lists.manage.iconHint')}>
					<IconPicker
						value={icon}
						mediaType={mediaType}
						onChange={iconChanged}
						disabled={submitting}
					/>
				</DrawerSection>

				<DrawerSection
					title={t('lists.manage.typeLabel')}
					description={
						renaming
							? t('lists.manage.typeLocked')
							: tracked
								? t('lists.manage.typeHintAniList')
								: t('lists.manage.typeHintLocal')
					}
				>
					<SelectionGroup
						options={typeOptions}
						value={mediaType}
						onValueChange={mediaTypeChanged}
						label={t('lists.manage.typeLabel')}
						disabled={submitting || renaming}
						stretch
					/>
				</DrawerSection>
			</DrawerForm>
		</Drawer>
	)
}
