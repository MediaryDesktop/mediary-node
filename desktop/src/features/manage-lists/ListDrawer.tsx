import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'

import { useTranslation } from '@shared/i18n'
import { Drawer, DrawerForm, DrawerSection, Input, RippleButton } from '@shared/ui'

import { LIST_MEDIA_TYPES, MediaTypeIcon } from '@entities/tracker'

import styles from './ListDrawer.module.scss'
import { manageListsModel } from './model'

export function ListDrawer() {
	const { t } = useTranslation()
	const nameRef = useRef<HTMLInputElement>(null)

	const [
		open,
		name,
		mediaType,
		editingID,
		canSubmit,
		submitting,
		close,
		nameChanged,
		mediaTypeChanged,
		submitted
	] = useUnit([
		manageListsModel.$open,
		manageListsModel.$name,
		manageListsModel.$mediaType,
		manageListsModel.$editingID,
		manageListsModel.$canSubmit,
		manageListsModel.$submitting,
		manageListsModel.drawerClosed,
		manageListsModel.nameChanged,
		manageListsModel.mediaTypeChanged,
		manageListsModel.submitted
	])

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => nameRef.current?.select())
		}
	}, [open])

	const renaming = editingID !== null
	const tracked = mediaType === 'anime' || mediaType === 'manga'

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={renaming ? t('lists.manage.renameTitle') : t('lists.manage.createTitle')}
			description={renaming ? undefined : t('lists.manage.createSubtitle')}
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
					<div className={styles.types} role='radiogroup' aria-label={t('lists.manage.typeLabel')}>
						{LIST_MEDIA_TYPES.map(type => (
							<RippleButton
								key={type}
								role='radio'
								aria-checked={type === mediaType}
								disabled={submitting || renaming}
								className={clsx(styles.type, type === mediaType && styles.selected)}
								onClick={() => mediaTypeChanged(type)}
							>
								<MediaTypeIcon type={type} size={24} />
								{t(`lists.mediaType.${type}`)}
							</RippleButton>
						))}
					</div>
				</DrawerSection>
			</DrawerForm>
		</Drawer>
	)
}
