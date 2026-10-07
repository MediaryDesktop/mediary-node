import { useUnit } from 'effector-react'
import { MdFormatListBulletedAdd } from 'react-icons/md'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { manageEntryModel, rateEntryModel } from '../../model/model'

import styles from './EntryMenu.module.scss'

export interface EntryMenuMedia {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
	siteUrl?: string
}

export interface EntryMenuProps {
	media: EntryMenuMedia
	// Null when the title is on no list yet: the menu then offers to add it.
	entry: TrackerEntry | null
	// The custom list the card is shown in, which the menu can take it out of.
	listName?: string
}

// The library knows a title only by its reference, so the AniList page is
// rebuilt from it when no catalog link came along.
function aniListUrl({ mediaRef, mediaType, siteUrl }: EntryMenuMedia): string | null {
	if (siteUrl) {
		return siteUrl
	}

	const [provider, id] = mediaRef.split(':')

	return provider === 'anilist' && id ? `https://anilist.co/${mediaType}/${id}` : null
}

export function EntryMenu({ media, entry, listName }: EntryMenuProps) {
	const { t } = useTranslation()

	const [updating, requestUpdate, manageOpened, addOpened, rateOpened] = useUnit([
		trackerModel.$updating,
		trackerModel.entryUpdateRequested,
		manageEntryModel.opened,
		manageEntryModel.addOpened,
		rateEntryModel.opened
	])

	const busy = Boolean(updating[media.mediaRef])
	const items: DropdownMenuItem[] = []

	if (entry) {
		const target = { entry, mediaType: media.mediaType }

		items.push(
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
			}
		)
	} else {
		items.push({
			id: 'add',
			label: t('lists.addEntry.action'),
			icon: <MdFormatListBulletedAdd size={20} />,
			disabled: busy,
			onSelect: () =>
				addOpened({ mediaRef: media.mediaRef, mediaType: media.mediaType, title: media.title })
		})
	}

	const url = aniListUrl(media)

	if (url) {
		items.push({
			id: 'anilist',
			label: t('media.openOn', { name: 'AniList' }),
			icon: 'common/external-link',
			onSelect: () => window.open(url, '_blank', 'noreferrer')
		})
	}

	if (entry && listName) {
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
				<RippleButton className={styles.trigger} aria-label={t('lists.menu')}>
					<Icon name='common/more-vertical' size={20} />
				</RippleButton>
			}
		/>
	)
}
