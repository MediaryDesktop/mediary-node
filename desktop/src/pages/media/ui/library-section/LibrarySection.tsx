import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { IoLibraryOutline } from 'react-icons/io5'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Badge, Button, Icon, Skeleton, toast, Tooltip } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { fileName, fileTitle, titleFilesQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import { episodeTitle, mediaEpisodesQuery } from '@entities/media'
import type { MediaEpisode } from '@entities/media'
import { $playerMode, playbackModel, playerOpened, thumbnailUrl } from '@entities/playback'

import {
	episodeFor,
	EpisodeImage,
	episodeNumber,
	episodeOrder,
	episodeSeason,
	groupTitleFiles,
	indexEpisodes,
	isWatched
} from '@features/continue-watching'
import type { EpisodeIndex } from '@features/continue-watching'

import { BookFiles } from './book-files/BookFiles'
import { ChapterList } from './chapter-list/ChapterList'
import styles from './LibrarySection.module.scss'

const MAX_EPISODE_PLACEHOLDERS = 28

export interface LibrarySectionProps {
	mediaRef: string
	title: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	mediaType: string
	progress: number
}

export function LibrarySection(props: LibrarySectionProps) {
	if (props.mediaType === 'manga') {
		return (
			<ChapterList
				mediaRef={props.mediaRef}
				title={props.title}
				progress={props.progress}
				coverColor={props.coverColor}
			/>
		)
	}

	if (props.mediaType === 'book') {
		return <BookFiles mediaRef={props.mediaRef} />
	}

	if (!VIDEO_TYPES.includes(props.mediaType)) {
		return null
	}

	return <EpisodeLibrary {...props} />
}

const VIDEO_TYPES = ['anime', 'movie', 'series', 'dorama']

// What the sources know about each episode, by number. Empty until they answer,
// and for good when they know nothing: every part of the page has to read well
// from the files alone.
function useEpisodeMeta(mediaRef: string): { meta: EpisodeIndex; count: number | null } {
	const [data, load, nodeReady] = useUnit([mediaEpisodesQuery.$data, mediaEpisodesQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load(mediaRef)
		}
	}, [mediaRef, load, nodeReady])

	return useMemo(() => {
		// Shared across title pages like the files query, so it may still hold the
		// previous title's list for a moment.
		const list = data?.episodes.media_ref === mediaRef ? data.episodes : null
		const episodes = list?.episodes ?? []

		return {
			meta: indexEpisodes(episodes),
			count: list?.total ?? (episodes.length > 0 ? episodes.length : null)
		}
	}, [data, mediaRef])
}

function useEpisodeText() {
	const { t, i18n } = useTranslation()

	const label = (file: LibraryFile, seasonal = false): string => {
		const number = episodeNumber(file)

		// A movie or an unnumbered file has no "Episode N" to show, so it goes by its name.
		if (number === null) {
			return fileTitle(file)
		}

		return seasonal
			? String(t('media.library.seasonEpisode', { season: episodeSeason(file) ?? 1, number }))
			: String(t('media.library.episode', { number }))
	}

	const name = (episode: MediaEpisode | undefined): string | null =>
		episode ? episodeTitle(episode, i18n.language) : null

	// The file's own length when the scan read it, the source's otherwise.
	const minutes = (file: LibraryFile | null, episode: MediaEpisode | undefined): string | null => {
		const value = file?.duration_seconds ? file.duration_seconds / 60 : episode?.runtime_minutes

		return value ? String(t('media.library.minutes', { count: Math.max(1, Math.round(value)) })) : null
	}

	const aired = (episode: MediaEpisode | undefined): string | null => {
		if (!episode?.air_date) {
			return null
		}

		const date = new Date(`${episode.air_date}T00:00:00Z`)
		if (Number.isNaN(date.getTime())) {
			return null
		}

		const formatted = new Intl.DateTimeFormat(i18n.language, {
			dateStyle: 'medium',
			timeZone: 'UTC'
		}).format(date)

		return String(t('media.library.aired', { date: formatted }))
	}

	return { label, name, minutes, aired }
}

function EpisodeLibrary({ mediaRef, cover, coverColor, banner, total, progress }: LibrarySectionProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()
	const { meta, count } = useEpisodeMeta(mediaRef)

	const [data, load, playExternally, session, starting, playerMode, nodeReady, openPlayer] = useUnit([
		titleFilesQuery.$data,
		titleFilesQuery.start,
		playbackModel.playRequested,
		playbackModel.$session,
		playbackModel.$starting,
		$playerMode,
		$nodeReady,
		playerOpened
	])

	const play = (fileId: number) => {
		if (playerMode === 'external') {
			playExternally(fileId)
		} else {
			openPlayer(fileId)
		}
	}

	useEffect(() => {
		if (nodeReady) {
			load({ mediaRef, kind: 'video' })
		}
	}, [mediaRef, load, nodeReady])

	useUnitWatch(playbackModel.playFailed, ({ error }) =>
		toast.error(problemDetail(error, t('playback.failed')), { id: 'playback-failed' })
	)

	// The query is shared across title pages, so what it holds may still be the
	// previous title's files for a moment after navigating.
	const files = (data?.files.items ?? []).filter(file => file.match?.media_ref === mediaRef)

	if (files.length === 0) {
		return (
			<NotInLibrary
				cover={cover}
				coverColor={coverColor}
				banner={banner}
				total={total ?? count}
				meta={meta}
			/>
		)
	}

	const order = episodeOrder(meta)
	const groups = groupTitleFiles(files, progress, order)
	const fallback = banner ?? cover

	// "/ 62" next to "S2 · E5" would compare a number within a season to the
	// whole show's count.
	const of = meta.seasonal ? null : (total ?? count)

	// The source's still first: it is chosen to show the episode without spoiling
	// it. A frame from the file stands in when the source has none.
	const imagesFor = (file: LibraryFile, episode: MediaEpisode | undefined) => [
		episode?.image,
		file.missing ? null : thumbnailUrl(file.id),
		fallback
	]

	const item = (file: LibraryFile) => {
		const episode = episodeFor(meta, file)

		return (
			<EpisodeItem
				key={file.id}
				file={file}
				episode={episode}
				seasonal={meta.seasonal}
				images={imagesFor(file, episode)}
				coverColor={coverColor}
				watched={isWatched(file, progress, order)}
				playing={session?.file_id === file.id}
				disabled={starting}
				onPlay={play}
			/>
		)
	}

	return (
		<section className={styles.section}>
			{groups.toWatch.length > 0 && (
				<ToWatchRail>
					{groups.toWatch.map(file => {
						const episode = episodeFor(meta, file)
						const name = text.name(episode)
						const duration = text.minutes(file, episode)
						const number = episodeNumber(file)

						return (
							<li key={file.id}>
								<button
									type='button'
									className={styles.card}
									disabled={starting}
									aria-label={t('media.library.play', {
										name: text.label(file, meta.seasonal)
									})}
									onClick={() => play(file.id)}
								>
									<span
										className={styles.cardImage}
										style={{ backgroundColor: coverColor ?? undefined }}
									>
										<EpisodeImage sources={imagesFor(file, episode)} />
										<span className={styles.cardPlay}>
											<Icon name='common/play' size={32} />
										</span>
									</span>

									<span className={styles.cardText}>
										{name && <span className={styles.cardName}>{name}</span>}
										<span className={styles.cardRow}>
											<span className={styles.cardTitle}>
												{text.label(file, meta.seasonal)}
												{number !== null && of ? (
													<span className={styles.cardOf}> / {of}</span>
												) : null}
											</span>
											{duration && <span className={styles.cardMeta}>{duration}</span>}
										</span>
									</span>
								</button>
							</li>
						)
					})}
				</ToWatchRail>
			)}

			{meta.seasonal ? (
				seasonsOf(groups.main).map(([season, seasonFiles]) => (
					<div key={season}>
						<h3 className={styles.groupTitle}>{t('media.library.season', { number: season })}</h3>
						<ul className={styles.episodes}>{seasonFiles.map(item)}</ul>
					</div>
				))
			) : (
				<ul className={styles.episodes}>{groups.main.map(item)}</ul>
			)}

			{groups.specials.length > 0 && (
				<>
					<h3 className={styles.groupTitle}>{t('media.library.specials')}</h3>
					<ul className={styles.episodes}>{groups.specials.map(item)}</ul>
				</>
			)}

			{groups.others.length > 0 && (
				<>
					<h3 className={styles.groupTitle}>{t('media.library.others')}</h3>
					<ul className={styles.episodes}>{groups.others.map(item)}</ul>
				</>
			)}
		</section>
	)
}

// Files in season order, already sorted, split where the season changes.
function seasonsOf(files: LibraryFile[]): [number, LibraryFile[]][] {
	const seasons: [number, LibraryFile[]][] = []

	for (const file of files) {
		const season = episodeSeason(file) ?? 1
		const last = seasons.at(-1)

		if (last && last[0] === season) {
			last[1].push(file)
		} else {
			seasons.push([season, [file]])
		}
	}

	return seasons
}

function ToWatchRail({ children }: { children: ReactNode }) {
	const { t } = useTranslation()
	const rail = useRef<HTMLUListElement>(null)

	const scroll = (direction: -1 | 1) => {
		const element = rail.current
		if (element) {
			element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' })
		}
	}

	return (
		<div className={styles.rail}>
			<div className={styles.railControls}>
				<Button
					variant='ghost'
					size='small'
					iconOnly
					aria-label={t('media.library.previous')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={() => scroll(-1)}
				/>
				<Button
					variant='ghost'
					size='small'
					iconOnly
					aria-label={t('media.library.next')}
					startIcon={<Icon name='common/arrow-right' size={18} />}
					onClick={() => scroll(1)}
				/>
			</div>

			<ul ref={rail} className={styles.toWatch} aria-label={t('media.library.toWatch')}>
				{children}
			</ul>
		</div>
	)
}

interface EpisodeItemProps {
	file: LibraryFile
	episode: MediaEpisode | undefined
	seasonal: boolean
	images: (string | null | undefined)[]
	coverColor: string | null
	watched: boolean
	playing: boolean
	disabled: boolean
	onPlay: (fileId: number) => void
}

function EpisodeItem({
	file,
	episode,
	seasonal,
	images,
	coverColor,
	watched,
	playing,
	disabled,
	onPlay
}: EpisodeItemProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()
	const label = text.label(file, seasonal)
	const name = text.name(episode)
	const duration = text.minutes(file, episode)

	return (
		<li className={clsx(styles.episode, watched && styles.watched)}>
			<button
				type='button'
				className={styles.episodeImage}
				style={{ backgroundColor: coverColor ?? undefined }}
				disabled={disabled || file.missing}
				aria-label={t('media.library.play', { name: label })}
				onClick={() => onPlay(file.id)}
			>
				<EpisodeImage sources={images} />
				<span className={styles.episodePlay}>
					<Icon name='common/play' size={24} />
				</span>
			</button>

			<EpisodeText
				label={label}
				name={name}
				duration={duration}
				overview={episode?.overview ?? null}
				badge={playing && <Badge tone='accent'>{t('media.library.playing')}</Badge>}
			>
				<span className={styles.episodeFile} title={file.rel_path}>
					{fileName(file)}
				</span>
				{file.missing && <span className={styles.missing}>{t('media.library.missing')}</span>}
			</EpisodeText>

			<EpisodeAside episode={episode} watched={watched} />
		</li>
	)
}

interface EpisodeTextProps {
	label: string
	name: string | null
	duration: string | null
	overview: string | null
	badge?: ReactNode
	children?: ReactNode
}

function EpisodeText({ label, name, duration, overview, badge, children }: EpisodeTextProps) {
	return (
		<span className={styles.episodeContent}>
			<span className={styles.episodeHeader}>
				<span className={styles.episodeLabel}>{label}</span>
				{duration && <span className={styles.episodeDuration}>{duration}</span>}
				{badge}
			</span>
			{name && <span className={styles.episodeName}>{name}</span>}
			{overview && <span className={styles.episodeOverview}>{overview}</span>}
			{children}
		</span>
	)
}

function EpisodeAside({ episode, watched }: { episode: MediaEpisode | undefined; watched: boolean }) {
	const { t } = useTranslation()
	const text = useEpisodeText()
	const aired = text.aired(episode)
	const overview = episode?.overview

	if (!watched && !overview && !aired) {
		return null
	}

	return (
		<span className={styles.episodeAside}>
			{watched && (
				<span className={styles.watchedMark} title={t('media.library.watched')}>
					<Icon name='common/check' size={16} />
				</span>
			)}

			{(overview || aired) && (
				<Tooltip
					side='left'
					content={
						<span className={styles.episodeInfo}>
							{aired && <span className={styles.episodeAired}>{aired}</span>}
							{overview && <span>{overview}</span>}
						</span>
					}
				>
					<button type='button' className={styles.infoButton} aria-label={t('media.library.about')}>
						<Icon name='common/info' size={16} />
					</button>
				</Tooltip>
			)}
		</span>
	)
}

interface Placeholder {
	key: string
	label: string
	episode: MediaEpisode | undefined
}

interface NotInLibraryProps {
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	meta: EpisodeIndex
}

function NotInLibrary({ cover, coverColor, banner, total, meta }: NotInLibraryProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()

	if (!total) {
		return null
	}

	// A show listed by season is drawn from the list itself, since numbers repeat
	// across seasons; anything else from its count, with whatever the list knows.
	const placeholders: Placeholder[] = meta.seasonal
		? meta.list.slice(0, MAX_EPISODE_PLACEHOLDERS).map(episode => ({
				key: `${episode.season}:${episode.number}`,
				label: String(
					t('media.library.seasonEpisode', { season: episode.season ?? 1, number: episode.number })
				),
				episode
			}))
		: Array.from({ length: Math.min(total, MAX_EPISODE_PLACEHOLDERS) }, (_, index) => ({
				key: String(index + 1),
				label: String(t('media.library.episode', { number: index + 1 })),
				episode: meta.byKey.get(`:${index + 1}`)
			}))

	const shown = placeholders.length
	const known = meta.list.some(episode => episode.title || episode.overview || episode.image)

	return (
		<section className={styles.section}>
			<h2 className={styles.libraryTitle}>
				<IoLibraryOutline size={20} />
				{t('media.library.notInLibrary')}
			</h2>

			<p className={styles.libraryText}>{t('media.library.episodesNotInLibrary')}</p>
			{!known && <p className={styles.libraryNotice}>{t('media.library.metadataUnavailable')}</p>}

			<ul className={styles.episodes}>
				{placeholders.map(({ key, label, episode }) => {
					return (
						<li key={key} className={styles.episode}>
							<span
								className={clsx(
									styles.episodeImage,
									!episode?.image && styles.placeholderImage
								)}
								style={{ backgroundColor: coverColor ?? undefined }}
							>
								<EpisodeImage sources={[episode?.image, banner ?? cover]} />
							</span>

							{known ? (
								<EpisodeText
									label={label}
									name={text.name(episode)}
									duration={text.minutes(null, episode)}
									overview={episode?.overview ?? null}
								/>
							) : (
								<span className={styles.episodeContent}>
									<span className={styles.episodeHeader}>
										<span className={styles.episodeLabel}>{label}</span>
									</span>
									<span className={styles.episodePlaceholder}>
										<Skeleton width='70%' height='0.75rem' />
										<Skeleton width='45%' height='0.75rem' />
									</span>
								</span>
							)}

							<EpisodeAside episode={episode} watched={false} />
						</li>
					)
				})}
			</ul>

			{(meta.seasonal ? meta.list.length : total) > shown && (
				<p className={styles.libraryText}>{t('media.library.andMore')}</p>
			)}
		</section>
	)
}
