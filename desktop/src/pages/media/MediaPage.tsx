import { useNavigate, useRouter } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, Modal, PageTransition, Skeleton, Tooltip } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import {
	alternativeTitles,
	enumLabel,
	formatMediaDate,
	MediaCard,
	mediaDetailsModel,
	mediaTitle,
	scoreTone
} from '@entities/media'
import type { MediaDetails, MediaSource } from '@entities/media'
import { trackerQueries } from '@entities/tracker'
import type { TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { EntryEditor } from '@features/track-media'

import { formatCompact, formatRelative, formatWeekday } from './lib'
import styles from './MediaPage.module.scss'

const MAX_EPISODE_PLACEHOLDERS = 28

function isTrackerMediaType(value: string): value is TrackerMediaType {
	return value === 'anime' || value === 'manga'
}

function useTrackerEntry(mediaRef: string): TrackerEntry | null {
	const { connected, anime, manga, animeStatus, mangaStatus, startAnime, startManga } = useUnit({
		connected: aniListAccountModel.$connected,
		anime: trackerQueries.anime.$data,
		manga: trackerQueries.manga.$data,
		animeStatus: trackerQueries.anime.$status,
		mangaStatus: trackerQueries.manga.$status,
		startAnime: trackerQueries.anime.start,
		startManga: trackerQueries.manga.start
	})

	useEffect(() => {
		if (!connected) {
			return
		}

		if (animeStatus === 'initial') {
			startAnime()
		}

		if (mangaStatus === 'initial') {
			startManga()
		}
	}, [connected, animeStatus, mangaStatus, startAnime, startManga])

	const entries = [...(anime?.entries ?? []), ...(manga?.entries ?? [])]

	return entries.find(entry => entry.media_ref === mediaRef) ?? null
}

export interface MediaPageProps {
	mediaRef: string
}

export function MediaPage({ mediaRef }: MediaPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const { data, failedMediaRef, requestDetails } = useUnit({
		data: mediaDetailsModel.$data,
		failedMediaRef: mediaDetailsModel.$failedMediaRef,
		requestDetails: mediaDetailsModel.detailsRequested
	})

	const entry = useTrackerEntry(mediaRef)

	useEffect(() => {
		window.scrollTo({ top: 0 })
		requestDetails(mediaRef)
	}, [mediaRef, requestDetails])

	const details = data?.media.media_ref === mediaRef ? data : null
	const failed = !details && failedMediaRef === mediaRef

	return (
		<PageTransition className={styles.root}>
			<Button
				variant='glass'
				size='small'
				className={styles.back}
				startIcon={<Icon name='common/arrow-left' size={18} />}
				onClick={() => router.history.back()}
			>
				{t('media.back')}
			</Button>

			{details && <MediaView media={details.media} sources={details.sources ?? []} entry={entry} />}

			{!details && !failed && <MediaSkeleton />}

			{failed && entry && (
				<>
					<p className={styles.offline}>{t('media.offline')}</p>
					<MediaView media={null} sources={[]} entry={entry} />
				</>
			)}

			{failed && !entry && (
				<div className={styles.failure}>
					<p>{t('media.failed')}</p>
					<Button size='small' onClick={() => requestDetails(mediaRef)}>
						{t('media.retry')}
					</Button>
				</div>
			)}
		</PageTransition>
	)
}

interface MediaViewProps {
	media: MediaDetails | null
	sources: MediaSource[]
	entry: TrackerEntry | null
}

function MediaView({ media, sources, entry }: MediaViewProps) {
	const { t, i18n } = useTranslation()
	const [descriptionOpen, setDescriptionOpen] = useState(false)
	const [entryOpen, setEntryOpen] = useState(false)
	const [detailsOpen, setDetailsOpen] = useState(false)

	const base = media ?? entry?.media
	if (!base) {
		return null
	}

	const locale = i18n.language
	const mediaType = media?.media_type ?? entry?.media_type ?? 'anime'
	const title = mediaTitle(base.title)
	const alternatives = alternativeTitles(base.title)
	const description = media?.description ?? ''
	const cover = base.cover_image
	const backdrop = base.banner_image ?? cover
	const total = mediaType === 'manga' ? base.chapters : base.episodes
	const airingStatus = base.status
	const startDate = media ? formatMediaDate(media.start_date, locale) : null
	const season = media?.season ? enumLabel(t, 'season', media.season) : null

	return (
		<>
			<header className={styles.hero}>
				<div className={styles.backdrop} style={{ backgroundColor: base.cover_color ?? undefined }}>
					{backdrop && (
						<img
							src={backdrop}
							alt=''
							className={base.banner_image ? undefined : styles.blurred}
							draggable={false}
						/>
					)}

					<span className={styles.fadeTop} />
					<span className={styles.fadeLeft} />
					<span className={styles.fadeLeftSoft} />
					<span className={styles.fadeBottom} />
				</div>

				<div className={styles.details}>
					<div className={styles.entry}>
						<div
							className={styles.cover}
							style={{ backgroundColor: base.cover_color ?? undefined }}
						>
							{cover && <img src={cover} alt='' draggable={false} />}
						</div>

						<div className={styles.info}>
							<h1 className={styles.title}>{title}</h1>

							{alternatives.map(name => (
								<p key={name} className={styles.alternative}>
									{name}
								</p>
							))}

							<div className={styles.metaRow}>
								{entry && entry.score > 0 && (
									<span className={clsx(styles.userScore, styles[scoreTone(entry.score)])}>
										<Icon name='common/star' size={16} />
										{entry.score / 10}
									</span>
								)}

								<span className={styles.progress}>
									{entry?.progress ?? 0}
									<span className={styles.progressTotal}>/{total ?? '-'}</span>
								</span>

								{entry && (
									<span className={styles.listStatus}>
										{isTrackerMediaType(mediaType)
											? t(`lists.status.${mediaType}.${entry.status}` as never, {
													defaultValue: entry.status
												})
											: entry.status}
									</span>
								)}

								<span className={styles.divider} />

								{startDate && (
									<span className={styles.date}>
										<Icon name='common/calendar' size={17} />
										{season ? `${startDate} - ${season}` : startDate}
									</span>
								)}

								{airingStatus && airingStatus !== 'FINISHED' && (
									<span className={styles.airing}>
										<Icon name='common/signal' size={16} />
										{enumLabel(t, 'status', airingStatus)}
									</span>
								)}
							</div>

							<div className={styles.tagRow}>
								{media?.mean_score != null && (
									<span
										className={clsx(
											styles.audienceScore,
											styles[scoreTone(media.mean_score)]
										)}
										title={t('media.stats.averageScore')}
									>
										<Icon name='common/heart' size={14} />
										{media.mean_score / 10}
									</span>
								)}

								{media?.studios?.[0] && (
									<span className={styles.studio}>{media.studios[0]}</span>
								)}

								{media?.genres?.map(genre => (
									<span key={genre} className={styles.genre}>
										{genre}
									</span>
								))}

								{media?.popularity != null && (
									<span className={styles.stat} title={t('media.stats.popularity')}>
										<Icon name='common/users' size={14} />
										{formatCompact(media.popularity, locale)}
									</span>
								)}
							</div>

							{media && (
								<button
									type='button'
									className={styles.description}
									onClick={() => setDescriptionOpen(true)}
								>
									{description || t('media.noDescription')}
								</button>
							)}

							<div className={styles.links}>
								<a
									className={styles.iconLink}
									href={base.site_url}
									target='_blank'
									rel='noreferrer'
									aria-label={t('media.openOn', { name: sources[0]?.name ?? 'AniList' })}
								>
									<Icon name='social/anilist' size={18} />
								</a>

								<Tooltip content={t('media.comingSoon')}>
									<span className={styles.iconActionWrap}>
										<button type='button' disabled className={styles.textLink}>
											{t('media.trailer')}
										</button>
									</span>
								</Tooltip>
							</div>
						</div>
					</div>
				</div>
			</header>

			<div className={styles.actions}>
				<div className={styles.actionButtons}>
					{entry && isTrackerMediaType(mediaType) ? (
						<Tooltip content={t('media.editEntry')}>
							<Button
								iconOnly
								variant='ghost'
								className={styles.iconAction}
								aria-label={t('media.editEntry')}
								onClick={() => setEntryOpen(true)}
							>
								<Icon name='common/pencil' size={16} />
							</Button>
						</Tooltip>
					) : (
						<Tooltip content={t('media.comingSoon')}>
							<span className={styles.iconActionWrap}>
								<Button
									iconOnly
									variant='ghost'
									disabled
									className={styles.iconAction}
									aria-label={t('media.addToList')}
								>
									<Icon name='common/plus' size={16} />
								</Button>
							</span>
						</Tooltip>
					)}

					<DropdownMenu
						trigger={
							<Button
								iconOnly
								variant='ghost'
								className={styles.iconAction}
								aria-label={t('media.menu.label')}
							>
								<Icon name='common/more-vertical' size={18} />
							</Button>
						}
						items={[
							{
								id: 'details',
								label: t('media.menu.details'),
								icon: 'common/info',
								onSelect: () => setDetailsOpen(true)
							},
							{
								id: 'anilist',
								label: t('media.openOn', { name: sources[0]?.name ?? 'AniList' }),
								icon: 'common/external-link',
								onSelect: () => window.open(base.site_url, '_blank', 'noreferrer')
							},
							{
								id: 'library',
								label: t('media.menu.addToLibrary'),
								icon: 'common/library',
								disabled: true,
								onSelect: () => {}
							}
						]}
					/>

					<Tooltip content={t('media.comingSoon')}>
						<span className={styles.iconActionWrap}>
							<Button disabled startIcon={<Icon name='common/download' size={20} />}>
								{t('media.downloadBatch', { count: total ?? 0 })}
							</Button>
						</span>
					</Tooltip>
				</div>

				<div className={styles.viewTabs} role='tablist'>
					<Button
						role='tab'
						aria-selected
						variant='ghost'
						className={styles.viewTab}
						startIcon={<Icon name='common/library' size={20} />}
					>
						{t('media.views.library')}
					</Button>

					<Tooltip content={t('media.comingSoon')}>
						<span className={styles.iconActionWrap}>
							<Button
								role='tab'
								aria-selected={false}
								disabled
								variant='ghost'
								className={styles.viewTab}
							>
								{t('media.views.torrent')}
							</Button>
						</span>
					</Tooltip>
				</div>
			</div>

			{media?.next_airing_episode && (
				<p className={styles.nextAiring}>
					<span className={styles.nextAiringEpisode}>
						{t('media.nextAiringDay', {
							episode: media.next_airing_episode.episode,
							when: formatRelative(media.next_airing_episode.airing_at, locale)
						})}
					</span>
					<Icon name='common/calendar' size={17} />
					<span className={styles.nextAiringDay}>
						{formatWeekday(media.next_airing_episode.airing_at, locale)}
					</span>
				</p>
			)}

			<div className={styles.sections}>
				<LibrarySection media={base} total={total} mediaType={mediaType} />

				{media?.relations && media.relations.length > 0 && (
					<section className={styles.section}>
						<h2 className={styles.sectionTitle}>{t('media.sections.relations')}</h2>

						<ul className={styles.relations}>
							{media.relations.map(relation => (
								<li key={`${relation.relation_type}-${relation.media_ref}`}>
									<RelationCard relation={relation} />
								</li>
							))}
						</ul>
					</section>
				)}

				{sources.length > 0 && (
					<footer className={styles.sources}>
						{sources.map(source => (
							<a key={source.id} href={source.url} target='_blank' rel='noreferrer'>
								{t('media.source', { name: source.name })}
							</a>
						))}
					</footer>
				)}
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

			{entry && isTrackerMediaType(mediaType) && (
				<Modal
					open={entryOpen}
					onOpenChange={setEntryOpen}
					title={title}
					description={t('media.sections.entry')}
				>
					<EntryEditor entry={entry} mediaType={mediaType} />
				</Modal>
			)}

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

function RelationCard({ relation }: { relation: NonNullable<MediaDetails['relations']>[number] }) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<MediaCard
			media={relation}
			cornerLabel={enumLabel(t, 'relation', relation.relation_type)}
			previewRef={relation.media_ref}
			onOpen={() => navigate({ to: '/media/$mediaRef', params: { mediaRef: relation.media_ref } })}
		/>
	)
}

interface LibrarySectionProps {
	media: { cover_image: string | null; cover_color: string | null; banner_image?: string | null }
	total: number | null | undefined
	mediaType: string
}

function LibrarySection({ media, total, mediaType }: LibrarySectionProps) {
	const { t } = useTranslation()

	if (mediaType !== 'anime' || !total) {
		return null
	}

	const shown = Math.min(total, MAX_EPISODE_PLACEHOLDERS)
	const episodes = Array.from({ length: shown }, (_, index) => index + 1)

	return (
		<section className={styles.section}>
			<h2 className={styles.libraryTitle}>
				<Icon name='common/library' size={20} />
				{t('media.library.notInLibrary')}
			</h2>

			<p className={styles.libraryText}>{t('media.library.episodesNotInLibrary')}</p>
			<p className={styles.libraryNotice}>{t('media.library.metadataUnavailable')}</p>

			<ul className={styles.episodes}>
				{episodes.map(number => (
					<li key={number} className={styles.episode}>
						<span
							className={styles.episodeImage}
							style={{ backgroundColor: media.cover_color ?? undefined }}
						>
							{media.cover_image && <img src={media.cover_image} alt='' loading='lazy' />}
						</span>

						<span className={styles.episodeContent}>
							<span className={styles.episodeTitle}>
								{t('media.library.episode', { number })}
							</span>
							<span className={styles.episodePlaceholder}>
								<Skeleton width='70%' height='0.75rem' />
								<Skeleton width='45%' height='0.75rem' />
							</span>
						</span>
					</li>
				))}
			</ul>

			{total > shown && <p className={styles.libraryText}>{t('media.library.andMore')}</p>}
		</section>
	)
}

interface MediaFactsProps {
	media: MediaDetails
	mediaType: string
	locale: string
}

function MediaFacts({ media, mediaType, locale }: MediaFactsProps) {
	const { t } = useTranslation()

	const facts: [string, ReactNode][] = []
	const addFact = (label: string, value: ReactNode) => {
		if (value !== null && value !== undefined && value !== '') {
			facts.push([label, value])
		}
	}

	addFact(t('media.fields.format'), enumLabel(t, 'format', media.format))
	addFact(t('media.fields.status'), enumLabel(t, 'status', media.status))

	if (mediaType === 'manga') {
		addFact(t('media.fields.chapters'), media.chapters)
		addFact(t('media.fields.volumes'), media.volumes)
	} else {
		addFact(t('media.fields.episodes'), media.episodes)
		addFact(
			t('media.fields.duration'),
			media.duration ? t('media.minutes', { count: media.duration }) : null
		)
	}

	addFact(t('media.fields.start'), formatMediaDate(media.start_date, locale))
	addFact(t('media.fields.end'), formatMediaDate(media.end_date, locale))
	addFact(t('media.fields.studios'), media.studios?.join(', '))
	addFact(t('media.fields.source'), enumLabel(t, 'origin', media.source))
	addFact(t('media.fields.country'), media.country_of_origin)
	addFact(
		t('media.stats.favourites'),
		media.favourites != null ? formatCompact(media.favourites, locale) : null
	)

	return (
		<>
			<dl className={styles.facts}>
				{facts.map(([label, value]) => (
					<div key={label} className={styles.fact}>
						<dt>{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>

			{media.synonyms && media.synonyms.length > 0 && (
				<div className={styles.synonyms}>
					<span>{t('media.fields.synonyms')}</span>
					{media.synonyms.map(synonym => (
						<p key={synonym}>{synonym}</p>
					))}
				</div>
			)}
		</>
	)
}

function MediaSkeleton() {
	return (
		<div aria-busy className={styles.hero}>
			<div className={styles.backdrop}>
				<span className={styles.fadeBottom} />
			</div>

			<div className={styles.details}>
				<div className={styles.entry}>
					<Skeleton className={styles.cover} height='auto' radius='var(--radius-lg)' />

					<div className={styles.info}>
						<Skeleton width='55%' height='2.75rem' />
						<Skeleton width='30%' height='1.25rem' />
						<Skeleton width='42%' height='1.5rem' />
						<Skeleton width='60%' height='1rem' />
						<Skeleton width='100%' height='4rem' radius='var(--radius)' />
					</div>
				</div>
			</div>
		</div>
	)
}
