import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { manageEntryModel, rateEntryModel } from '../model/model'

import styles from './EntryMenu.module.scss'

export interface EntryMenuProps {
	entry: TrackerEntry
	mediaType: TrackerMediaType
	listName?: string
}

export function EntryMenu({ entry, mediaType, listName }: EntryMenuProps) {
	const { t } = useTranslation()

	const [updating, requestUpdate, manageOpened, rateOpened] = useUnit([
		trackerModel.$updating,
		trackerModel.entryUpdateRequested,
		manageEntryModel.opened,
		rateEntryModel.opened
	])

	const busy = Boolean(updating[entry.media_ref])
	const target = { entry, mediaType }

	const items: DropdownMenuItem[] = [
		{
			id: 'manage',
			label: t('lists.manageEntry.action'),
			icon: 'common/folder',
			disabled: busy,
			onSelect: () => manageOpened(target)
		},
		{
			id: 'rate',
			label: t('lists.rateEntry.action'),
			icon: 'common/pencil',
			disabled: busy,
			onSelect: () => rateOpened(target)
		},
		{
			id: 'anilist',
			label: t('media.openOn', { name: 'AniList' }),
			icon: 'common/external-link',
			onSelect: () => window.open(entry.media.site_url, '_blank', 'noreferrer')
		}
	]

	if (listName) {
		items.push({
			id: 'remove',
			label: t('lists.removeFromList'),
			icon: 'common/trash',
			danger: true,
			disabled: busy,
			onSelect: () =>
				requestUpdate({
					mediaRef: entry.media_ref,
					patch: {
						custom_lists: (entry.custom_lists ?? []).filter(name => name !== listName)
					}
				})
		})
	}

	return (
		<DropdownMenu
			items={items}
			trigger={
				<button type='button' className={styles.trigger} aria-label={t('lists.menu')}>
					<Icon name='common/more-vertical' size={20} />
				</button>
			}
		/>
	)
}
