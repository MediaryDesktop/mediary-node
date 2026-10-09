import { useUnit } from 'effector-react'
import { MdFormatListBulletedAdd } from 'react-icons/md'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { isLocalTrackerType, trackerModel } from '@entities/tracker'
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

interface SourceLink {
	name: string
	url: string
}

// The library knows a title only by its reference, so the source's page is
// rebuilt from it when no catalog link came along.
function sourceLink({ mediaRef, mediaType, siteUrl }: EntryMenuMedia): SourceLink | null {
	const [provider, first, second] = mediaRef.split(':')

	if (provider === 'tmdb') {
		const url = siteUrl ?? (first && second ? `https://www.themoviedb.org/${first}/${second}` : null)

		return url ? { name: 'TMDB', url } : null
	}

	if (provider === 'openlibrary') {
		const url = siteUrl ?? (first ? `https://openlibrary.org/works/${first}` : null)

		return url ? { name: 'Open Library', url } : null
	}

	const url =
		siteUrl ?? (provider === 'anilist' && first ? `https://anilist.co/${mediaType}/${first}` : null)

	return url ? { name: 'AniList', url } : null
}

export function EntryMenu({ media, entry, listName }: EntryMenuProps) {
	const { t } = useTranslation()

	const [updating, requestUpdate, requestDelete, manageOpened, addOpened, rateOpened] = useUnit([
		trackerModel.$updating,
		trackerModel.entryUpdateRequested,
		trackerModel.entryDeleteRequested,
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

	const link = sourceLink(media)

	if (link) {
		items.push({
			id: 'source',
			label: t('media.openOn', { name: link.name }),
			icon: 'common/external-link',
			onSelect: () => window.open(link.url, '_blank', 'noreferrer')
		})
	}

	// Only the node's own list can drop a title outright; AniList's is edited there.
	if (entry && !listName && isLocalTrackerType(media.mediaType)) {
		items.push({
			id: 'delete',
			label: t('lists.deleteEntry'),
			icon: 'common/trash',
			danger: true,
			disabled: busy,
			onSelect: () => requestDelete(entry.media_ref)
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
				<RippleButton className={styles.trigger} aria-label={t('lists.menu')} disableRipple>
					<Icon name='common/more-vertical' size={20} />
				</RippleButton>
			}
		/>
	)
}
