import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard, mediaTitle } from '@entities/media'
import type { MediaDetails } from '@entities/media'
import { canTrack, entryTracking, useTrackedEntries } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import styles from './RelationsSection.module.scss'

export type RelatedTitle = NonNullable<MediaDetails['relations']>[number]

export interface RelatedCardsProps {
	titles: RelatedTitle[]
	// What a card is to this title — "Sequel" — when there is something to say.
	cornerLabel?: (title: RelatedTitle) => string | undefined
}

// A grid of titles another title points at, each opening its own page and
// offering the list menu where the title can be tracked.
export function RelatedCards({ titles, cornerLabel }: RelatedCardsProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)

	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	return (
		<ul className={styles.relations}>
			{titles.map(title => {
				const entry = trackedByRef.get(title.media_ref)

				return (
					<li key={`${title.relation_type}-${title.media_ref}`}>
						<MediaCard
							media={title}
							cornerLabel={cornerLabel?.(title)}
							tracking={entry ? entryTracking(entry, t) : null}
							menu={
								canTrack(title.media_type, connected) ? (
									<EntryMenu
										media={{
											mediaRef: title.media_ref,
											mediaType: title.media_type,
											title: mediaTitle(title.title)
										}}
										entry={entry ?? null}
									/>
								) : undefined
							}
							previewRef={title.media_ref}
							onOpen={() =>
								navigate({
									to: '/media/$mediaRef',
									params: { mediaRef: title.media_ref }
								})
							}
						/>
					</li>
				)
			})}
		</ul>
	)
}
