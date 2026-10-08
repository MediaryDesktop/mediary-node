import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import type { LibraryCollectionEntry } from '@entities/library-item'
import { MediaCard } from '@entities/media'
import { canTrack, entryTracking, useTrackedEntries } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import styles from './LibraryCollection.module.scss'

export interface LibraryCollectionProps {
	entries: LibraryCollectionEntry[]
}

export function LibraryCollection({ entries }: LibraryCollectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)
	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	return (
		<ul className={styles.grid}>
			{entries.map(entry => {
				const trackedEntry = trackedByRef.get(entry.media_ref)
				const mediaType = trackedEntry?.media_type ?? entry.title?.media_type

				return (
					<li key={entry.media_ref}>
						<MediaCard
							media={{
								// The library knows a title by one name; the card is built for the
								// catalog's several, so the one there is stands in for all of them.
								title: {
									user_preferred: entry.title?.title ?? entry.media_ref,
									english: null,
									romaji: null,
									native: null
								},
								cover_image: entry.title?.cover_image ?? null,
								cover_color: entry.title?.cover_color ?? null
							}}
							// The same hover preview a list or search card shows — from the
							// tracked entry when the title is on a list, from the catalog
							// otherwise — so the library shelf reads like the rest of the app.
							previewRef={entry.media_ref}
							tracking={trackedEntry ? entryTracking(trackedEntry, t) : null}
							menu={
								mediaType && canTrack(mediaType, connected) ? (
									<EntryMenu
										media={{
											mediaRef: entry.media_ref,
											mediaType,
											title: entry.title?.title ?? entry.media_ref,
											siteUrl: trackedEntry?.media.site_url
										}}
										entry={trackedEntry ?? null}
									/>
								) : undefined
							}
							previewExtra={
								<span className={styles.episodesMeta}>
									<Icon name='common/play' size={13} />
									{entry.title?.episodes
										? t('library.summary.filesOf', {
												// A missing file isn't one the library has, so it comes
												// straight off the count the card shows — one number to
												// read instead of a count and a caveat beside it.
												count: entry.file_count - entry.missing_count,
												total: entry.title.episodes
											})
										: t('library.summary.files', {
												count: entry.file_count - entry.missing_count
											})}
								</span>
							}
							onOpen={() =>
								navigate({ to: '/media/$mediaRef', params: { mediaRef: entry.media_ref } })
							}
						/>
					</li>
				)
			})}
		</ul>
	)
}
