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
import { useMissingToolAction } from '@entities/tool'

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

	const missingTool = useMissingToolAction()

	useUnitWatch(playbackModel.playFailed, ({ error }) =>
		toast.error(problemDetail(error, t('playback.failed')), {
			id: 'playback-failed',
			action: missingTool(error)
		})
	)

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

	const of = meta.seasonal ? null : (total ?? count)

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
