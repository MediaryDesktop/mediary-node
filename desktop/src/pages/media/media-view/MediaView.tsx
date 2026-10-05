import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, formatWeekday } from '@shared/lib'
import { Icon, Modal } from '@shared/ui'

import { mediaTitle } from '@entities/media'
import type { MediaDetails, MediaSource } from '@entities/media'
import type { TrackerEntry } from '@entities/tracker'

import { resolveSubject } from '../lib/media-view'
import { LibrarySection } from '../library-section/LibrarySection'
import { MediaActions } from '../media-actions/MediaActions'
import { MediaFacts } from '../media-facts/MediaFacts'
import { MediaHero } from '../media-hero/MediaHero'
import { RelationsSection } from '../relations-section/RelationsSection'

import styles from './MediaView.module.scss'

export interface MediaViewProps {
	mediaRef: string
	media: MediaDetails | null
	sources: MediaSource[]
	entry: TrackerEntry | null
}

export function MediaView({ mediaRef, media, sources, entry }: MediaViewProps) {
	const { t, i18n } = useTranslation()
	const [descriptionOpen, setDescriptionOpen] = useState(false)
	const [detailsOpen, setDetailsOpen] = useState(false)

	const subject = resolveSubject(media, entry)

	if (!subject) {
		return null
	}

	const { base, mediaType, total } = subject
	const locale = i18n.language
	const title = mediaTitle(base.title)
	const description = media?.description ?? ''
	const airing = media?.next_airing_episode

	return (
		<>
			<MediaHero
				base={base}
				media={media}
				entry={entry}
				sources={sources}
				mediaType={mediaType}
				total={total}
				locale={locale}
				onOpenDescription={() => setDescriptionOpen(true)}
			/>

			<MediaActions
				entry={entry}
				sources={sources}
				mediaType={mediaType}
				siteUrl={base.site_url}
				total={total}
				onOpenDetails={() => setDetailsOpen(true)}
			/>

			{airing && (
				<p className={styles.nextAiring}>
					<span className={styles.nextAiringEpisode}>
						{t('media.nextAiringDay', {
							episode: airing.episode,
							when: formatRelativeTime(airing.airing_at, locale, { maxUnit: 'day' })
						})}
					</span>
					<Icon name='common/calendar' size={17} />
					<span className={styles.nextAiringDay}>{formatWeekday(airing.airing_at, locale)}</span>
				</p>
			)}

			<div className={styles.sections}>
				<LibrarySection
					mediaRef={mediaRef}
					title={title}
					cover={base.cover_image}
					coverColor={base.cover_color}
					banner={base.banner_image}
					total={total}
					mediaType={mediaType}
					progress={entry?.progress ?? 0}
				/>

				<RelationsSection relations={media?.relations ?? []} />
			</div>

			<Modal
				open={descriptionOpen}
				onOpenChange={setDescriptionOpen}
				title={title}
				description={t('media.sections.synopsis')}
				size='lg'
			>
				<p className={styles.fullDescription}>{description || t('media.noDescription')}</p>
			</Modal>

			{media && (
				<Modal
					open={detailsOpen}
					onOpenChange={setDetailsOpen}
					title={title}
					description={t('media.sections.details')}
				>
					<MediaFacts media={media} mediaType={mediaType} locale={locale} />
				</Modal>
			)}
		</>
	)
}
