import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'

import { episodeLabel } from '@entities/media'
import type { CardPlayContext, MediaCardSlots } from '@entities/media'
import { useTorrentSetup } from '@entities/torrent'

import { PlayMenu } from '@features/continue-watching'
import type { PlayEntry } from '@features/continue-watching'
import { episodeDownloadRequested } from '@features/download-torrent'
import { episodeMarked } from '@features/mark-progress'
import { $streamTarget, $streamVia, effectiveVia, streamRequested } from '@features/stream-torrent'

function CardPlay({
	mediaRef,
	mediaType,
	title,
	label,
	progress,
	listed,
	trailer,
	onOpen,
	onDownload
}: CardPlayContext) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [mark, stream, downloadEpisode, streamTarget, chosenVia] = useUnit([
		episodeMarked,
		streamRequested,
		episodeDownloadRequested,
		$streamTarget,
		$streamVia
	])

	const via = effectiveVia(chosenVia, Boolean(setup.debrid))

	const entryLabel = (entry: PlayEntry) => episodeLabel(t, entry.number, entry.season)

	const streamEntry = (entry: PlayEntry | null) => {
		if (!entry && mediaType !== 'movie') {
			onOpen?.()
			return
		}

		stream({
			key: entry ? `${mediaRef}/${entry.season ?? ''}:${entry.number}` : `${mediaRef}/movie`,
			label: entry ? `${title} · ${entryLabel(entry)}` : title,
			params: {
				media_ref: mediaRef,
				title,
				episode: entry?.number,
				season: entry?.season ?? undefined,
				auto: true,
				via
			}
		})
	}

	return (
		<PlayMenu
			mediaRef={mediaRef}
			label={label}
			progress={progress}
			hasTrailer={trailer}
			busy={streamTarget !== null}
			onOpen={onOpen}
			onDownload={onDownload}
			onTrailer={() =>
				void navigate({ to: '/media/$mediaRef', params: { mediaRef }, search: { trailer: true } })
			}
			onMarkWatched={episode => mark({ mediaRef, episode, watched: true, progress, listed })}
			onStream={streamEntry}
			onDownloadEpisode={entry =>
				downloadEpisode({
					mediaRef,
					title,
					episode: entry.number,
					season: entry.season ?? undefined,
					label: `${title} · ${entryLabel(entry)}`
				})
			}
		/>
	)
}

export const MEDIA_CARD_SLOTS: MediaCardSlots = {
	play: context => <CardPlay {...context} />
}
