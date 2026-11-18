import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { episodeNumber } from '@features/continue-watching'

import { useEpisodeText } from '../../lib/useEpisodeText'

import { EpisodeCard } from './EpisodeCard'

export interface ToWatchCardProps {
	file: LibraryFile
	episode: MediaEpisode | undefined
	seasonal: boolean
	of: number | null | undefined
	images: (string | null | undefined)[]
	coverColor: string | null
	disabled: boolean
	onPlay: (fileId: number) => void
}

export function ToWatchCard({
	file,
	episode,
	seasonal,
	of,
	images,
	coverColor,
	disabled,
	onPlay
}: ToWatchCardProps) {
	const text = useEpisodeText()

	return (
		<EpisodeCard
			label={text.label(file, seasonal)}
			name={text.name(episode)}
			duration={text.minutes(file, episode)}
			of={episodeNumber(file) !== null ? of : null}
			images={images}
			coverColor={coverColor}
			disabled={disabled}
			onPlay={() => onPlay(file.id)}
		/>
	)
}
