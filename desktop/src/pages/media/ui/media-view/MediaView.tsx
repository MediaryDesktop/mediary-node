import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, formatWeekday, useUnitWatch } from '@shared/lib'
import { Icon, Modal, PhaseTransition } from '@shared/ui'

import { mediaTitle } from '@entities/media'
import type { MediaDetails, MediaSource } from '@entities/media'
import { useTorrentSetup } from '@entities/torrent'
import type { TrackerEntry } from '@entities/tracker'

import {
	searchClosed,
	searchOpened,
	TorrentSearchDrawer,
	useMissingEpisodes
} from '@features/search-torrents'
import type { ReleaseWatching } from '@features/search-torrents'
import { $streamTarget, $streamVia, streamCancelled, streamRequested } from '@features/stream-torrent'

import { resolveSubject } from '../../lib/media-view'
import { LibrarySection } from '../library-section/LibrarySection'
import { MediaActions } from '../media-actions/MediaActions'
import type { MediaView as MediaViewKind } from '../media-actions/MediaActions'
import { MediaFacts } from '../media-facts/MediaFacts'
import { MediaHero } from '../media-hero/MediaHero'
import { RecommendationsSection } from '../relations-section/RecommendationsSection'
import { RelationsSection } from '../relations-section/RelationsSection'
import { StreamSection } from '../stream-section/StreamSection'
import { TorrentSection } from '../torrent-section/TorrentSection'

import styles from './MediaView.module.scss'

// Kinds watched as video: what can be played without downloading it first.
const VIDEO_TYPES = ['anime', 'movie', 'series', 'dorama']

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
	const [openSearch, closeSearch, streamTarget, requestStream, cancelStream, chosenVia] = useUnit([
		searchOpened,
		searchClosed,
		$streamTarget,
		streamRequested,
		streamCancelled,
		$streamVia
	])
	const setup = useTorrentSetup()

	// The search sheet gives way to the player, which opens the moment a stream is
	// asked for — from here or from the stream view — and covers it.
	useUnitWatch(streamRequested, () => closeSearch())

	const subject = resolveSubject(media, entry)
	// Manga is read and books too: neither is downloaded as video, nor tracks missing
	// episodes — asking for them would only race the library section's own file query
	// for the same title, over the one kind the library section actually reads.
	const torrents = subject ? subject.mediaType !== 'manga' && subject.mediaType !== 'book' : false
	// Files of a show numbered by season cannot be compared with its whole count,
	// so it offers no "download what is missing" until downloads know seasons.
	const seasonal = mediaRef.startsWith('tmdb:tv:')
	const missing = useMissingEpisodes(
		mediaRef,
		seasonal ? null : releasedEpisodes(media, subject?.total),
		torrents
	)

	if (!subject) {
		return null
	}

	const { base, mediaType, total } = subject
	const locale = i18n.language
	const title = mediaTitle(base.title)
	const description = media?.description ?? ''
	const airing = media?.next_airing_episode

	// The built-in client streams any video; a debrid service is a faster way, not a need.
	const streamable = torrents && VIDEO_TYPES.includes(mediaType)
	const shown: MediaViewKind = view === 'stream' && !streamable ? 'library' : view
	const via = setup.debrid ? chosenVia : 'embedded'

	const releaseKey = (id: string) => `${mediaRef}/release:${id}`
	const watching: ReleaseWatching | undefined = streamable
		? {
				activeId:
					streamTarget?.key.startsWith(`${mediaRef}/release:`) === true
						? streamTarget.key.slice(`${mediaRef}/release:`.length)
						: null,
				busy: streamTarget !== null,
				onWatch: (release, episode) =>
					requestStream({
						key: releaseKey(release.id),
						label: release.title,
						params: {
							media_ref: mediaRef,
							title,
							release_id: release.id,
							episode: episode.episode,
							season: episode.season,
							via
						}
					}),
				onCancel: cancelStream
			}
		: undefined

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
				view={shown}
				onViewChange={torrents ? setView : undefined}
				streamable={streamable}
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
					watching={watching}
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
				<PhaseTransition phase={shown}>
					{shown === 'torrent' ? (
						<TorrentSection mediaRef={mediaRef} title={title} poster={base.cover_image} />
					) : shown === 'stream' ? (
						<StreamSection
							mediaRef={mediaRef}
							title={title}
							mediaType={mediaType}
							cover={base.cover_image}
							coverColor={base.cover_color}
							banner={base.banner_image}
							released={seasonal ? null : releasedEpisodes(media, total)}
							progress={entry?.progress ?? 0}
						/>
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
				</PhaseTransition>

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
