import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { useCardHold } from '@entities/media'
import { isLocalTrackerType, trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import styles from './EntryMenu.module.scss'

export interface EntryMenuMedia {
	mediaRef: string
	mediaType: TrackerMediaType
	title: string
	siteUrl?: string
}

export interface EntryMenuProps {
	media: EntryMenuMedia
	entry: TrackerEntry | null
	listName?: string
	triggerClassName?: string
}

interface SourceLink {
	name: string
	url: string
}

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

	if (provider === 'googlebooks') {
		const url = siteUrl ?? (first ? `https://books.google.com/books?id=${first}` : null)

		return url ? { name: 'Google Books', url } : null
	}

	const url =
		siteUrl ?? (provider === 'anilist' && first ? `https://anilist.co/${mediaType}/${first}` : null)

	return url ? { name: 'AniList', url } : null
}

export function EntryMenu({ media, entry, listName, triggerClassName }: EntryMenuProps) {
	const { t } = useTranslation()
	const hold = useCardHold()

	const [updating, requestUpdate, requestDelete] = useUnit([
		trackerModel.$updating,
		trackerModel.entryUpdateRequested,
		trackerModel.entryDeleteRequested
	])

	const busy = Boolean(updating[media.mediaRef])
	const items: DropdownMenuItem[] = []

	const link = sourceLink(media)

	if (link) {
		items.push({
			id: 'source',
			label: t('media.openOn', { name: link.name }),
			icon: 'common/external-link',
			onSelect: () => window.open(link.url, '_blank', 'noreferrer')
		})
	}

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
			onOpenChange={hold}
			trigger={
				<RippleButton
					className={clsx(styles.trigger, triggerClassName)}
					aria-label={t('lists.menu')}
					disableRipple
				>
					<Icon name='common/more-vertical' size={20} />
				</RippleButton>
			}
		/>
	)
}
