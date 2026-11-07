import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import type { MediaEpisode } from '@entities/media'

import { EpisodeImage } from '@features/continue-watching'

import { EpisodeAside } from './EpisodeAside'
import styles from './EpisodeRow.module.scss'
import { EpisodeText } from './EpisodeText'

export interface EpisodeRowItemProps {
	label: string
	name: string | null
	duration: string | null
	episode: MediaEpisode | undefined
	images: (string | null | undefined)[]
	coverColor: string | null
	watched: boolean
	disabled: boolean
	onPlay: () => void
	badge?: ReactNode
	children?: ReactNode
}

export function EpisodeRowItem({
	label,
	name,
	duration,
	episode,
	images,
	coverColor,
	watched,
	disabled,
	onPlay,
	badge,
	children
}: EpisodeRowItemProps) {
	const { t } = useTranslation()

	return (
		<li className={clsx(styles.episode, watched && styles.watched)}>
			<button
				type='button'
				className={styles.episodeImage}
				style={{ backgroundColor: coverColor ?? undefined }}
				disabled={disabled}
				aria-label={t('media.library.play', { name: label })}
				onClick={onPlay}
			>
				<EpisodeImage sources={images} />
				<span className={styles.episodePlay}>
					<Icon name='common/play' size={24} />
				</span>
			</button>

			<EpisodeText
				label={label}
				name={name}
				duration={duration}
				overview={episode?.overview ?? null}
				badge={badge}
			>
				{children}
			</EpisodeText>

			<EpisodeAside episode={episode} watched={watched} />
		</li>
	)
}
