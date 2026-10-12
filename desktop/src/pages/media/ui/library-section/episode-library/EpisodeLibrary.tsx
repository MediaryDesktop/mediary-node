import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { titleFilesQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'
import { $playerMode, playbackModel, playerOpened, thumbnailUrl } from '@entities/playback'

import { episodeFor, episodeOrder, groupTitleFiles, isWatched } from '@features/continue-watching'

import { EpisodeItem } from '../episode-row/EpisodeItem'
import rowStyles from '../episode-row/EpisodeRow.module.scss'
import sectionStyles from '../EpisodeSection.module.scss'
import { seasonsOf } from '../lib/seasons'
import { useEpisodeMeta } from '../lib/useEpisodeMeta'
import { NotInLibrary } from '../not-in-library/NotInLibrary'

import { ToWatchCard } from './to-watch-rail/ToWatchCard'
import { ToWatchRail } from './to-watch-rail/ToWatchRail'

export interface EpisodeLibraryProps {
	mediaRef: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	progress: number
}

// The title's video files: what is left to watch first, then every episode by
// season, then specials and the rest.
export function EpisodeLibrary({
	mediaRef,
	cover,
	coverColor,
	banner,
	total,
	progress
}: EpisodeLibraryProps) {
	const { t } = useTranslation()
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

	const group = (title: string, list: LibraryFile[]) =>
		list.length > 0 && (
			<>
				<h3 className={sectionStyles.groupTitle}>{title}</h3>
				<ul className={rowStyles.episodes}>{list.map(item)}</ul>
			</>
		)

	return (
		<section className={sectionStyles.section}>
			{groups.toWatch.length > 0 && (
				<ToWatchRail>
					{groups.toWatch.map(file => {
						const episode = episodeFor(meta, file)

						return (
							<ToWatchCard
								key={file.id}
								file={file}
								episode={episode}
								seasonal={meta.seasonal}
								of={of}
								images={imagesFor(file, episode)}
								coverColor={coverColor}
								disabled={starting}
								onPlay={play}
							/>
						)
					})}
				</ToWatchRail>
			)}

			{meta.seasonal ? (
				seasonsOf(groups.main).map(([season, seasonFiles]) => (
					<div key={season}>
						{group(t('media.library.season', { number: season }), seasonFiles)}
					</div>
				))
			) : (
				<ul className={rowStyles.episodes}>{groups.main.map(item)}</ul>
			)}

			{group(t('media.library.specials'), groups.specials)}
			{group(t('media.library.others'), groups.others)}
		</section>
	)
}
