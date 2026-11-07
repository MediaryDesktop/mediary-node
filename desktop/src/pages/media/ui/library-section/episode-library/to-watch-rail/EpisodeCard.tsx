import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { EpisodeImage } from '@features/continue-watching'

import styles from './ToWatchRail.module.scss'

export interface EpisodeCardProps {
	label: string
	name: string | null
	duration?: string | null
	of?: number | null
	images: (string | null | undefined)[]
	coverColor: string | null
	disabled: boolean
	onPlay: () => void
}

export function EpisodeCard({
	label,
	name,
	duration,
	of,
	images,
	coverColor,
	disabled,
	onPlay
}: EpisodeCardProps) {
	const { t } = useTranslation()

	return (
		<li>
			<button
				type='button'
				className={styles.card}
				disabled={disabled}
				aria-label={t('media.library.play', { name: label })}
				onClick={onPlay}
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
							{of ? <span className={styles.cardOf}> / {of}</span> : null}
						</span>
						{duration && <span className={styles.cardMeta}>{duration}</span>}
					</span>
				</span>
			</button>
		</li>
	)
}
