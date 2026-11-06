import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Carousel, Icon, PhaseTransition, Skeleton } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard, mediaTitle } from '@entities/media'
import type { MediaSummary } from '@entities/media'
import { canTrack, entryTracking, useTrackedEntries } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import type { SectionState } from '../../model/model'

import styles from './DiscoverRow.module.scss'

const SKELETONS = 8

export interface DiscoverRowProps {
	title: ReactNode
	icon: IconName
	state: SectionState | undefined
	onRetry: () => void
}

export function DiscoverRow({ title, icon, state, onRetry }: DiscoverRowProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)
	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	const items = state?.items ?? []

	if (items.length === 0 && state?.status === 'done') {
		return null
	}

	const phase = items.length > 0 ? 'loaded' : state?.status === 'failed' ? 'failed' : 'loading'

	const heading = (
		<h2 className={styles.title}>
			<Icon name={icon} size={24} className={styles.titleIcon} />
			{title}
		</h2>
	)

	const body =
		phase === 'failed' ? (
			<section className={styles.section}>
				{heading}
				<div className={styles.failed}>
					<p>{t('discover.rowFailed')}</p>
					<Button size='small' variant='secondary' onClick={onRetry}>
						{t('media.retry')}
					</Button>
				</div>
			</section>
		) : phase === 'loading' ? (
			<section className={styles.section}>
				{heading}
				<div className={styles.skeletons}>
					{Array.from({ length: SKELETONS }, (_, index) => (
						<Skeleton key={index} height='auto' className={styles.skeleton} radius='14px' />
					))}
				</div>
			</section>
		) : (
			<Carousel title={title} icon={icon}>
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

	return <PhaseTransition phase={phase}>{body}</PhaseTransition>
}
