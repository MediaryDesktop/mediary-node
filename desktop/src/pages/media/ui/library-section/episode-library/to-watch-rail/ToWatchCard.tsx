import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import type { LibraryFile } from '@entities/library-item'
import type { MediaEpisode } from '@entities/media'

import { EpisodeImage, episodeNumber } from '@features/continue-watching'

import { useEpisodeText } from '../../lib/useEpisodeText'

import styles from './ToWatchRail.module.scss'

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
	const { t } = useTranslation()
	const text = useEpisodeText()
	const label = text.label(file, seasonal)
	const name = text.name(episode)
	const duration = text.minutes(file, episode)

	return (
		<li>
			<button
				type='button'
				className={styles.card}
				disabled={disabled}
				aria-label={t('media.library.play', { name: label })}
				onClick={() => onPlay(file.id)}
			>
				<span className={styles.cardImage} style={{ backgroundColor: coverColor ?? undefined }}>
					<EpisodeImage sources={images} />
					<span className={styles.cardPlay}>
						<Icon name='common/play' size={32} />
					</span>
				</span>

				<span className={styles.cardText}>
					{name && <span className={styles.cardName}>{name}</span>}
					<span className={styles.cardRow}>
						<span className={styles.cardTitle}>
							{label}
							{episodeNumber(file) !== null && of ? (
								<span className={styles.cardOf}> / {of}</span>
							) : null}
						</span>
						{duration && <span className={styles.cardMeta}>{duration}</span>}
					</span>
				</span>
			</button>
		</li>
	)
}
