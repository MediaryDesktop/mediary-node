import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import type { CardPlayContext, MediaCardSlots } from '@entities/media'

import { PlayMenu } from '@features/continue-watching'
import { episodeMarked } from '@features/mark-progress'

function CardPlay({ mediaRef, label, progress, listed, trailer, onOpen, onDownload }: CardPlayContext) {
	const navigate = useNavigate()
	const mark = useUnit(episodeMarked)

	return (
		<PlayMenu
			mediaRef={mediaRef}
			label={label}
			progress={progress}
			hasTrailer={trailer}
			onOpen={onOpen}
			onDownload={onDownload}
			onTrailer={() =>
				void navigate({ to: '/media/$mediaRef', params: { mediaRef }, search: { trailer: true } })
			}
			onMarkWatched={episode => mark({ mediaRef, episode, watched: true, progress, listed })}
		/>
	)
}

export const MEDIA_CARD_SLOTS: MediaCardSlots = {
	play: context => <CardPlay {...context} />
}
