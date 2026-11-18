import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Notice } from '@shared/ui'

import { episodeLabel } from '@entities/media'
import { useTorrentSetup } from '@entities/torrent'

import { episodeMarked, listableEpisode } from '@features/mark-progress'
import { searchOpened } from '@features/search-torrents'
import {
	$autoSelect,
	$streamTarget,
	$streamVia,
	effectiveVia,
	streamRequested
} from '@features/stream-torrent'

import { useEpisodeMeta } from '../../lib/useEpisodeMeta'
import { useEpisodeText } from '../../lib/useEpisodeText'
import rowStyles from '../episode-row/EpisodeRow.module.scss'
import { EpisodeRowItem } from '../episode-row/EpisodeRowItem'
import sectionStyles from '../episode-section/EpisodeSection.module.scss'
import { EpisodeCard } from '../to-watch-rail/EpisodeCard'
import { ToWatchRail } from '../to-watch-rail/ToWatchRail'

import { streamItems, upNext } from './lib/stream-items'
import type { StreamItem } from './lib/stream-items'
import { StreamSettings } from './stream-settings/StreamSettings'
import styles from './StreamSection.module.scss'

const RAIL_SIZE = 8

export interface StreamSectionProps {
	mediaRef: string
	title: string
	mediaType: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	released: number | null
	progress: number
	listed: boolean
}

export function StreamSection({
	mediaRef,
	title,
	mediaType,
	cover,
	coverColor,
	banner,
	released,
	progress,
	listed
}: StreamSectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()
	const { meta, count } = useEpisodeMeta(mediaRef)
	const text = useEpisodeText()

	const [target, request, openSearch, chosenVia, autoSelect, markEpisode] = useUnit([
		$streamTarget,
		streamRequested,
		searchOpened,
		$streamVia,
		$autoSelect,
		episodeMarked
	])

	const via = effectiveVia(chosenVia, Boolean(setup.debrid))

	const items = streamItems({
		mediaType,
		title,
		meta,
		released: released ?? count,
		labels: {
			episode: number => episodeLabel(t, number, null),
			seasonEpisode: (season, number) => episodeLabel(t, number, season)
		}
	})
	const toWatch = upNext(items, progress, RAIL_SIZE)
	const fallback = banner ?? cover
	const busy = target !== null
	const ofReleased = (item: StreamItem) => (!meta.seasonal && item.episode !== undefined ? released : null)

	const toggleWatched = (item: StreamItem) =>
		markEpisode({ mediaRef, episode: item.position, watched: item.position > progress, progress, listed })

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
			openSearch({
				episode: item.episode,
				season: item.season,
				intent: 'watch',
				preview: {
					label: item.label,
					name: text.name(item.meta),
					duration: text.minutes(null, item.meta),
					of: ofReleased(item),
					images: [item.meta?.image, fallback],
					coverColor
				}
			})
		}
	}

	return (
		<section className={sectionStyles.section}>
			{setup.loaded && !setup.hasSources && (
				<Notice
					className={styles.setupNotice}
					tone='warning'
					title={t('torrents.setup.noSources')}
					actionLabel={t('torrents.setup.openSettings')}
					onAction={() => navigate({ to: '/settings', search: { section: 'torrents' } })}
				>
					{t('torrents.setup.noSourcesHint')}
				</Notice>
			)}

			<StreamSettings
				via={via}
				debridName={setup.debrid?.name ?? null}
				onOpenSettings={() => navigate({ to: '/settings', search: { section: 'torrents' } })}
			/>

			{toWatch.length > 0 && (
				<ToWatchRail>
					{toWatch.map(item => (
						<EpisodeCard
							key={item.key}
							label={item.label}
							name={text.name(item.meta)}
							of={ofReleased(item)}
							images={[item.meta?.image, fallback]}
							coverColor={coverColor}
							disabled={busy || !setup.hasSources}
							onPlay={() => play(item)}
						/>
					))}
				</ToWatchRail>
			)}

			<ul className={rowStyles.episodes}>
				{items.map(item => (
					<EpisodeRowItem
						key={item.key}
						label={item.label}
						name={text.name(item.meta)}
						duration={text.minutes(null, item.meta)}
						episode={item.meta}
						images={[item.meta?.image, fallback]}
						coverColor={coverColor}
						watched={item.position <= progress}
						disabled={busy || !setup.hasSources}
						onPlay={() => play(item)}
						onToggleWatched={
							listableEpisode(item.position) ? () => toggleWatched(item) : undefined
						}
					/>
				))}
			</ul>
		</section>
	)
}
