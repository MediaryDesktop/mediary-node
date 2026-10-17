import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'
import { Button, CollapsibleSection, Icon, Notice, SegmentedControl, Switch } from '@shared/ui'

import type { MediaEpisode } from '@entities/media'
import { useTorrentSetup } from '@entities/torrent'

import { EpisodeImage } from '@features/continue-watching'
import type { EpisodeIndex } from '@features/continue-watching'
import { searchOpened } from '@features/search-torrents'
import { $streamTarget, $streamVia, streamRequested, streamViaChanged } from '@features/stream-torrent'
import type { StreamVia } from '@features/stream-torrent'

import { ToWatchRail } from '../library-section/episode-library/to-watch-rail/ToWatchRail'
import cardStyles from '../library-section/episode-library/to-watch-rail/ToWatchRail.module.scss'
import { EpisodeAside } from '../library-section/episode-row/EpisodeAside'
import rowStyles from '../library-section/episode-row/EpisodeRow.module.scss'
import { EpisodeText } from '../library-section/episode-row/EpisodeText'
import sectionStyles from '../library-section/EpisodeSection.module.scss'
import { useEpisodeMeta } from '../library-section/lib/useEpisodeMeta'
import { useEpisodeText } from '../library-section/lib/useEpisodeText'

import styles from './StreamSection.module.scss'

const AUTO_SELECT_KEY = 'mediary.stream.autoSelect'
const SETTINGS_OPEN_KEY = 'mediary.stream.settingsOpen'

// The next episodes the rail offers, after what was watched.
const RAIL_SIZE = 8

// A list longer than this is an endless show; the rest is reached through search.
const MAX_EPISODES = 500

export interface StreamSectionProps {
	mediaRef: string
	title: string
	mediaType: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	// Episodes out so far; null when unknown.
	released: number | null
	progress: number
}

interface StreamItem {
	key: string
	episode?: number
	season?: number
	label: string
	meta: MediaEpisode | undefined
	// Where it falls in the whole run, which is what progress counts.
	position: number
}

// The title's episodes, played without downloading them into the library, as
// Seanime's torrent streaming view: through the built-in client, which plays the
// file as it comes, or the debrid service. With auto-select a click plays the
// best release at once, without it the search opens on that episode to pick one.
export function StreamSection({
	mediaRef,
	title,
	mediaType,
	cover,
	coverColor,
	banner,
	released,
	progress
}: StreamSectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()
	const { meta, count } = useEpisodeMeta(mediaRef)
	const text = useEpisodeText()

	const [target, request, openSearch, chosenVia, chooseVia] = useUnit([
		$streamTarget,
		streamRequested,
		searchOpened,
		$streamVia,
		streamViaChanged
	])

	// Without a debrid service the built-in client is the only way.
	const via: StreamVia = setup.debrid ? chosenVia : 'embedded'

	const [autoSelect, setAutoSelect] = useState(() => readStored(AUTO_SELECT_KEY) !== 'off')

	const changeAutoSelect = (on: boolean) => {
		setAutoSelect(on)
		writeStored(AUTO_SELECT_KEY, on ? 'on' : 'off')
	}

	// Shut by default: the explanation and the two choices are worth reading once,
	// not on every visit, so they sit behind a button rather than always in view.
	const [settingsOpen, setSettingsOpen] = useState(() => readStored(SETTINGS_OPEN_KEY) === 'on')

	const toggleSettings = () => {
		setSettingsOpen(on => {
			writeStored(SETTINGS_OPEN_KEY, on ? 'off' : 'on')
			return !on
		})
	}

	const items = streamItems({
		mediaType,
		title,
		meta,
		released: released ?? count,
		labels: {
			episode: number => String(t('media.library.episode', { number })),
			seasonEpisode: (season, number) => String(t('media.library.seasonEpisode', { season, number }))
		}
	})
	const toWatch = items.filter(item => item.position > progress).slice(0, RAIL_SIZE)
	const fallback = banner ?? cover
	// The player opens over this section the moment one is asked for, so a second
	// click has nothing to reach; this only guards the instant before it covers it.
	const busy = target !== null

	const play = (item: StreamItem) => {
		if (autoSelect) {
			request({
				key: `${mediaRef}/${item.key}`,
				label: mediaType === 'movie' ? title : `${title} · ${item.label}`,
				params: {
					media_ref: mediaRef,
					title,
					episode: item.episode,
					season: item.season,
					auto: true,
					via
				}
			})
		} else {
			openSearch({ episode: item.episode, season: item.season, intent: 'watch' })
		}
	}

	return (
		<section className={sectionStyles.section}>
			{setup.loaded && !setup.hasSources && (
				<Notice
					tone='warning'
					title={t('torrents.setup.noSources')}
					action={
						<Button
							size='small'
							variant='secondary'
							onClick={() =>
								navigate({ to: '/settings', search: { section: 'torrent-search' } })
							}
						>
							{t('torrents.setup.openSettings')}
						</Button>
					}
				>
					{t('torrents.setup.noSourcesHint')}
				</Notice>
			)}

			<div className={styles.settingsTrigger}>
				<Button
					variant='secondary'
					startIcon={<Icon name='common/settings' size={18} />}
					aria-expanded={settingsOpen}
					onClick={toggleSettings}
				>
					{t('media.stream.settings')}
				</Button>
			</div>

			<CollapsibleSection
				open={settingsOpen}
				className={clsx(settingsOpen && styles.settingsSectionOpen)}
			>
				<div className={styles.settings}>
					<p className={styles.explain}>{t('media.stream.explain')}</p>

					{!setup.debrid && (
						<Notice
							title={t('media.stream.debridPitch')}
							action={
								<Button
									size='small'
									variant='secondary'
									onClick={() =>
										navigate({ to: '/settings', search: { section: 'debrid' } })
									}
								>
									{t('torrents.setup.openSettings')}
								</Button>
							}
						>
							{t('media.stream.debridPitchHint')}
						</Notice>
					)}

					<div className={styles.toolbar}>
						{setup.debrid && (
							<SegmentedControl
								label={t('media.stream.via')}
								items={[
									{ value: 'embedded', label: t('media.stream.viaBuiltIn') },
									{ value: 'debrid', label: setup.debrid.name }
								]}
								value={via}
								onValueChange={chooseVia}
							/>
						)}
						<Switch
							checked={autoSelect}
							onChange={changeAutoSelect}
							label={t('media.stream.autoSelect')}
						/>
						<p className={styles.hint}>
							{!autoSelect
								? t('media.stream.manualHint')
								: via === 'embedded'
									? t('media.stream.autoSelectBuiltInHint')
									: t('media.stream.autoSelectHint', { service: setup.debrid?.name ?? '' })}
						</p>
					</div>
				</div>
			</CollapsibleSection>

			{toWatch.length > 0 && (
				<ToWatchRail>
					{toWatch.map(item => (
						<li key={item.key}>
							<button
								type='button'
								className={cardStyles.card}
								disabled={busy || !setup.hasSources}
								aria-label={t('media.library.play', { name: item.label })}
								onClick={() => play(item)}
							>
								<span
									className={cardStyles.cardImage}
									style={{ backgroundColor: coverColor ?? undefined }}
								>
									<EpisodeImage sources={[item.meta?.image, fallback]} />
									<span className={cardStyles.cardPlay}>
										<Icon name='common/play' size={32} />
									</span>
								</span>

								<span className={cardStyles.cardText}>
									{text.name(item.meta) && (
										<span className={cardStyles.cardName}>{text.name(item.meta)}</span>
									)}
									<span className={cardStyles.cardRow}>
										<span className={cardStyles.cardTitle}>
											{item.label}
											{!meta.seasonal && item.episode !== undefined && released ? (
												<span className={cardStyles.cardOf}> / {released}</span>
											) : null}
										</span>
									</span>
								</span>
							</button>
						</li>
					))}
				</ToWatchRail>
			)}

			<ul className={rowStyles.episodes}>
				{items.map(item => {
					const watched = item.position <= progress

					return (
						<li key={item.key} className={clsx(rowStyles.episode, watched && rowStyles.watched)}>
							<button
								type='button'
								className={rowStyles.episodeImage}
								style={{ backgroundColor: coverColor ?? undefined }}
								disabled={busy || !setup.hasSources}
								aria-label={t('media.library.play', { name: item.label })}
								onClick={() => play(item)}
							>
								<EpisodeImage sources={[item.meta?.image, fallback]} />
								<span className={rowStyles.episodePlay}>
									<Icon name='common/play' size={24} />
								</span>
							</button>

							<EpisodeText
								label={item.label}
								name={text.name(item.meta)}
								duration={text.minutes(null, item.meta)}
								overview={item.meta?.overview ?? null}
							/>

							<EpisodeAside episode={item.meta} watched={watched} />
						</li>
					)
				})}
			</ul>
		</section>
	)
}

interface Labels {
	episode: (number: number) => string
	seasonEpisode: (season: number, number: number) => string
}

function streamItems({
	mediaType,
	title,
	meta,
	released,
	labels
}: {
	mediaType: string
	title: string
	meta: EpisodeIndex
	released: number | null
	labels: Labels
}): StreamItem[] {
	// A film is one thing to play, and the node plays its largest video.
	if (mediaType === 'movie') {
		return [{ key: 'movie', label: title, meta: undefined, position: 1 }]
	}

	// A show listed by season goes by its list, since numbers repeat across seasons.
	if (meta.seasonal) {
		return meta.list.slice(0, MAX_EPISODES).map((episode, index) => ({
			key: `${episode.season ?? ''}:${episode.number}`,
			episode: episode.number,
			season: episode.season ?? undefined,
			label: labels.seasonEpisode(episode.season ?? 1, episode.number),
			meta: episode,
			position: index + 1
		}))
	}

	return Array.from({ length: Math.min(released ?? 0, MAX_EPISODES) }, (_, index) => {
		const number = index + 1

		return {
			key: `:${number}`,
			episode: number,
			label: labels.episode(number),
			meta: meta.byKey.get(`:${number}`),
			position: number
		}
	})
}
