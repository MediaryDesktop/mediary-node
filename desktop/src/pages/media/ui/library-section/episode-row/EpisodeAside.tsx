import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import type { MediaEpisode } from '@entities/media'

import { useEpisodeText } from '../lib/useEpisodeText'

import styles from './EpisodeRow.module.scss'

export interface EpisodeAsideProps {
	episode: MediaEpisode | undefined
	watched: boolean
}

export function EpisodeAside({ episode, watched }: EpisodeAsideProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()
	const aired = text.aired(episode)
	const overview = episode?.overview

	if (!watched && !overview && !aired) {
		return null
	}

	return (
		<span className={styles.episodeAside}>
			{watched && (
				<span className={styles.watchedMark} title={t('media.library.watched')}>
					<Icon name='common/check' size={16} />
				</span>
			)}

			{(overview || aired) && (
				<Tooltip
					side='left'
					content={
						<span className={styles.episodeInfo}>
							{aired && <span className={styles.episodeAired}>{aired}</span>}
							{overview && <span>{overview}</span>}
						</span>
					}
				>
					<button type='button' className={styles.infoButton} aria-label={t('media.library.about')}>
						<Icon name='common/info' size={16} />
					</button>
				</Tooltip>
			)}
		</span>
	)
}
