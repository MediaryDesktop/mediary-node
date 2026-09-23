import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Drawer, DrawerForm, DrawerSection, SelectionGroup } from '@shared/ui'

import { preferredTitle, TRACKER_STATUSES, trackerListsQuery } from '@entities/tracker'

import { manageEntryModel } from '../model/model'

import { EntryListPicker } from './list-picker/EntryListPicker'

export function ManageEntryDrawer() {
	const { t } = useTranslation()

	const [open, target, status, lists, dirty, saving, closed, statusChanged, listsChanged, submitted] =
		useUnit([
			manageEntryModel.$open,
			manageEntryModel.$target,
			manageEntryModel.$status,
			manageEntryModel.$lists,
			manageEntryModel.$dirty,
			manageEntryModel.$saving,
			manageEntryModel.closed,
			manageEntryModel.statusChanged,
			manageEntryModel.listsChanged,
			manageEntryModel.submitted
		])

	const collection = useUnit(trackerListsQuery.$data)
	const mediaType = target?.mediaType ?? 'anime'

	const options = useMemo(
		() =>
			(collection?.lists ?? [])
				.filter(list => list.provider === 'anilist' && list.media_type === mediaType)
				.map(list => ({ value: list.name, label: list.name })),
		[collection, mediaType]
	)

	const statusOptions = TRACKER_STATUSES.map(value => ({
		value,
		label: t(`lists.status.${mediaType}.${value}`)
	}))

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('lists.manageEntry.title')}
			description={target ? preferredTitle(target.entry.media.title) : undefined}
			closable={false}
		>
			<DrawerForm
				onSubmit={submitted}
				onCancel={closed}
				submitLabel={t('lists.manageEntry.save')}
				submitDisabled={!dirty || saving}
				cancelDisabled={saving}
				submitting={saving}
			>
				<DrawerSection
					title={t('lists.editor.status')}
					description={t('lists.manageEntry.statusHint')}
				>
					<SelectionGroup
						options={statusOptions}
						value={status}
						onValueChange={statusChanged}
						label={t('lists.editor.status')}
						disabled={saving}
						stretch
					/>
				</DrawerSection>

				<DrawerSection
					title={t('lists.manageEntry.lists')}
					description={
						options.length > 0
							? t('lists.manageEntry.listsHint')
							: t('lists.manageEntry.listsEmpty')
					}
				>
					{options.length > 0 && (
						<EntryListPicker
							options={options}
							selected={lists}
							disabled={saving}
							onChange={listsChanged}
						/>
					)}
				</DrawerSection>
			</DrawerForm>
		</Drawer>
	)
}
