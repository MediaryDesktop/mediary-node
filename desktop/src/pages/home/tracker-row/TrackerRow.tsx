import { Link, useNavigate } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Carousel } from '@shared/ui'

import { MediaCard } from '@entities/media'
import { entryTracking, preferredTitle } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType, TrackerStatus } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import styles from './TrackerRow.module.scss'

// A row is a glance, not the list: past this the "see all" link takes over.
const MAX_CARDS = 20

export interface TrackerRowProps {
	title: string
	status: TrackerStatus
	entries: TrackerEntry[]
}

// One of the user's status lists as a row of posters, with the same card, list
// state and menu as the list page itself.
export function TrackerRow({ title, status, entries }: TrackerRowProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	if (entries.length === 0) {
		return null
	}

	return (
		<Carousel
			aria-label={title}
			title={
				<span className={styles.heading}>
					{title}
					<span className={styles.count}>{entries.length}</span>
					<Link
						to='/lists/$listId'
						params={{ listId: `status:${status}` }}
						className={styles.seeAll}
					>
						{t('lists.seeAll')}
					</Link>
				</span>
			}
		>
			{entries.slice(0, MAX_CARDS).map(entry => (
				<MediaCard
					key={entry.media_ref}
					media={entry.media}
					scoreBadge={entry.media.average_score ?? undefined}
					tracking={entryTracking(entry, t)}
					menu={
						<EntryMenu
							media={{
								mediaRef: entry.media_ref,
								mediaType: entry.media_type as TrackerMediaType,
								title: preferredTitle(entry.media.title),
								siteUrl: entry.media.site_url
							}}
							entry={entry}
						/>
					}
					previewRef={entry.media_ref}
					onOpen={() => navigate({ to: '/media/$mediaRef', params: { mediaRef: entry.media_ref } })}
				/>
			))}
		</Carousel>
	)
}
