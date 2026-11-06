import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon } from '@shared/ui'

import { fileName } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { EpisodeImage } from '@features/continue-watching'

import { useEpisodeText } from '../lib/useEpisodeText'

import { EpisodeAside } from './EpisodeAside'
import styles from './EpisodeRow.module.scss'
import { EpisodeText } from './EpisodeText'

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
	const label = text.label(file, seasonal)

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
				name={text.name(episode)}
				duration={text.minutes(file, episode)}
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
