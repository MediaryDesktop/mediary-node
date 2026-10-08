import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { aniListAccountModel } from '@entities/anilist-account'
import { enumLabel, MediaCard, mediaTitle } from '@entities/media'
import type { MediaDetails } from '@entities/media'
import { entryTracking, isTrackerMediaType, useTrackedEntries } from '@entities/tracker'

import { EntryMenu } from '@features/track-media'

import styles from './RelationsSection.module.scss'

type Relation = NonNullable<MediaDetails['relations']>[number]

export interface RelationsSectionProps {
	relations: Relation[]
}

export function RelationsSection({ relations }: RelationsSectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const connected = useUnit(aniListAccountModel.$connected)
	const tracked = useTrackedEntries(connected)

	const trackedByRef = useMemo(() => new Map(tracked.map(entry => [entry.media_ref, entry])), [tracked])

	if (relations.length === 0) {
		return null
	}

	return (
		<section className={styles.section}>
			<h2 className={styles.sectionTitle}>{t('media.sections.relations')}</h2>

			<ul className={styles.relations}>
				{relations.map(relation => {
					const entry = trackedByRef.get(relation.media_ref)

					return (
						<li key={`${relation.relation_type}-${relation.media_ref}`}>
							<MediaCard
								media={relation}
								cornerLabel={enumLabel(t, 'relation', relation.relation_type)}
								tracking={entry ? entryTracking(entry, t) : null}
								menu={
									connected && isTrackerMediaType(relation.media_type) ? (
										<EntryMenu
											media={{
												mediaRef: relation.media_ref,
												mediaType: relation.media_type,
												title: mediaTitle(relation.title)
											}}
											entry={entry ?? null}
										/>
									) : undefined
								}
								previewRef={relation.media_ref}
								onOpen={() =>
									navigate({
										to: '/media/$mediaRef',
										params: { mediaRef: relation.media_ref }
									})
								}
							/>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
