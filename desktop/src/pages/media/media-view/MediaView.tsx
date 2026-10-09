import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, formatWeekday } from '@shared/lib'
import { Icon, Modal } from '@shared/ui'

import { mediaTitle } from '@entities/media'
import type { MediaDetails, MediaSource } from '@entities/media'
import type { TrackerEntry } from '@entities/tracker'

import { searchOpened, TorrentSearchDrawer, useMissingEpisodes } from '@features/search-torrents'

import { resolveSubject } from '../lib/media-view'
import { LibrarySection } from '../library-section/LibrarySection'
import { MediaActions } from '../media-actions/MediaActions'
import type { MediaView as MediaViewKind } from '../media-actions/MediaActions'
import { MediaFacts } from '../media-facts/MediaFacts'
import { MediaHero } from '../media-hero/MediaHero'
import { RecommendationsSection } from '../relations-section/RecommendationsSection'
import { RelationsSection } from '../relations-section/RelationsSection'
import { TorrentSection } from '../torrent-section/TorrentSection'

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
	const [view, setView] = useState<MediaViewKind>('library')
	const openSearch = useUnit(searchOpened)

	const subject = resolveSubject(media, entry)
	// Files of a show numbered by season cannot be compared with its whole count,
	// so it offers no "download what is missing" until downloads know seasons.
	const seasonal = mediaRef.startsWith('tmdb:tv:')
	const missing = useMissingEpisodes(mediaRef, seasonal ? null : releasedEpisodes(media, subject?.total))

	if (!subject) {
		return null
	}

	const { base, mediaType, total } = subject
	const locale = i18n.language
	const title = mediaTitle(base.title)
	const description = media?.description ?? ''
	const airing = media?.next_airing_episode
	// Manga is read and books too: neither is downloaded as video.
	const torrents = mediaType !== 'manga' && mediaType !== 'book'

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
				mediaRef={mediaRef}
				title={title}
				entry={entry}
				sources={sources}
				mediaType={mediaType}
				siteUrl={base.site_url}
				view={view}
				onViewChange={torrents ? setView : undefined}
				missingCount={missing?.length ?? null}
				onDownload={
					torrents
						? () => {
								setView('torrent')
								openSearch()
							}
						: undefined
				}
				onOpenDetails={() => setDetailsOpen(true)}
			/>

			{torrents && (
				<TorrentSearchDrawer
					mediaRef={mediaRef}
					title={title}
					missing={missing}
					poster={base.cover_image}
				/>
			)}

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
				{view === 'torrent' ? (
					<TorrentSection mediaRef={mediaRef} title={title} poster={base.cover_image} />
				) : (
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
				)}

				<RelationsSection relations={media?.relations ?? []} />

				<RecommendationsSection
					recommendations={media?.recommendations ?? []}
					similar={media?.similar ?? []}
				/>
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

// The episodes out so far: up to the one before the next to air for a title still
// airing, all of them otherwise. Null when the count is unknown.
function releasedEpisodes(media: MediaDetails | null, total: number | null | undefined): number | null {
	const next = media?.next_airing_episode?.episode
	if (next) {
		return next - 1
	}

	return total ?? null
}
