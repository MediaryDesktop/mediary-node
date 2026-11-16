import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import type { MediaEpisode } from '@entities/media'

import { useEpisodeText } from '../lib/useEpisodeText'

import styles from './EpisodeRow.module.scss'

export interface EpisodeAsideProps {
	label?: string
	episode: MediaEpisode | undefined
	watched: boolean
	onToggleWatched?: () => void
}

export function EpisodeAside({ label = '', episode, watched, onToggleWatched }: EpisodeAsideProps) {
	const { t } = useTranslation()
	const text = useEpisodeText()
	const aired = text.aired(episode)
	const overview = episode?.overview

	if (!watched && !overview && !aired && !onToggleWatched) {
		return null
	}

	const toggleLabel = t(watched ? 'media.library.markUnwatched' : 'media.library.markWatched', { label })

	return (
		<span className={styles.episodeAside}>
			{onToggleWatched ? (
				<button
					type='button'
					className={clsx(styles.watchedToggle, watched && styles.on)}
					aria-pressed={watched}
					aria-label={toggleLabel}
					title={toggleLabel}
					onClick={onToggleWatched}
				>
					<Icon name='common/check' size={16} />
				</button>
			) : (
				watched && (
					<span className={styles.watchedMark} title={t('media.library.watched')}>
						<Icon name='common/check' size={16} />
					</span>
				)
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
