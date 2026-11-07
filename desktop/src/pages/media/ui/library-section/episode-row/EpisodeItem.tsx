import { useTranslation } from '@shared/i18n'
import { Badge } from '@shared/ui'

import { fileName } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { useEpisodeText } from '../lib/useEpisodeText'

import styles from './EpisodeRow.module.scss'
import { EpisodeRowItem } from './EpisodeRowItem'

export interface EpisodeItemProps {
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

export function EpisodeItem({
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

	return (
		<EpisodeRowItem
			label={text.label(file, seasonal)}
			name={text.name(episode)}
			duration={text.minutes(file, episode)}
			episode={episode}
			images={images}
			coverColor={coverColor}
			watched={watched}
			disabled={disabled || file.missing}
			onPlay={() => onPlay(file.id)}
			badge={playing && <Badge tone='accent'>{t('media.library.playing')}</Badge>}
		>
			<span className={styles.episodeFile} title={file.rel_path}>
				{fileName(file)}
			</span>
			{file.missing && <span className={styles.missing}>{t('media.library.missing')}</span>}
		</EpisodeRowItem>
	)
}
