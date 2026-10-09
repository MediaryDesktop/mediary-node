import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Carousel, Skeleton } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard, mediaTitle } from '@entities/media'
import type { MediaSummary } from '@entities/media'
import { canTrack, entryTracking, useTrackedEntries } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import type { SectionState } from '../model/model'

import styles from './DiscoverRow.module.scss'

const SKELETONS = 8

export interface DiscoverRowProps {
	title: ReactNode
	state: SectionState | undefined
	onRetry: () => void
}

// One row of Discover: a source's list, as cards that open the title and offer
// the list menu, like every other grid of titles in the app.
export function DiscoverRow({ title, state, onRetry }: DiscoverRowProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)
	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	const items = state?.items ?? []

	if (items.length === 0 && state?.status === 'failed') {
		return (
			<section className={styles.section}>
				<h2 className={styles.title}>{title}</h2>
				<div className={styles.failed}>
					<p>{t('discover.rowFailed')}</p>
					<Button size='small' variant='secondary' onClick={onRetry}>
						{t('media.retry')}
					</Button>
				</div>
			</section>
		)
	}

	if (items.length === 0 && state?.status === 'done') {
		return null
	}

	if (items.length === 0) {
		return (
			<section className={styles.section}>
				<h2 className={styles.title}>{title}</h2>
				<div className={styles.skeletons}>
					{Array.from({ length: SKELETONS }, (_, index) => (
						<Skeleton key={index} className={styles.skeleton} radius='14px' />
					))}
				</div>
			</section>
		)
	}

	return (
		<Carousel title={title}>
			{items.map((media: MediaSummary) => {
				const entry = trackedByRef.get(media.media_ref)

				return (
					<MediaCard
						key={media.media_ref}
						media={media}
						scoreBadge={media.average_score ?? undefined}
						tracking={entry ? entryTracking(entry, t) : null}
						menu={
							canTrack(media.media_type, connected) ? (
								<EntryMenu
									media={{
										mediaRef: media.media_ref,
										mediaType: media.media_type,
										title: mediaTitle(media.title)
									}}
									entry={entry ?? null}
								/>
							) : undefined
						}
						previewRef={media.media_ref}
						onOpen={() =>
							navigate({ to: '/media/$mediaRef', params: { mediaRef: media.media_ref } })
						}
					/>
				)
			})}
		</Carousel>
	)
}
