import { useTranslation } from '@shared/i18n'
import { Icon, Skeleton } from '@shared/ui'

import styles from './LibrarySection.module.scss'

const MAX_EPISODE_PLACEHOLDERS = 28

export interface LibrarySectionProps {
	cover: string | null
	coverColor: string | null
	total: number | null | undefined
	mediaType: string
}

export function LibrarySection({ cover, coverColor, total, mediaType }: LibrarySectionProps) {
	const { t } = useTranslation()

	if (mediaType !== 'anime' || !total) {
		return null
	}

	const shown = Math.min(total, MAX_EPISODE_PLACEHOLDERS)
	const episodes = Array.from({ length: shown }, (_, index) => index + 1)

	return (
		<section className={styles.section}>
			<h2 className={styles.libraryTitle}>
				<Icon name='common/library' size={20} />
				{t('media.library.notInLibrary')}
			</h2>

			<p className={styles.libraryText}>{t('media.library.episodesNotInLibrary')}</p>
			<p className={styles.libraryNotice}>{t('media.library.metadataUnavailable')}</p>

			<ul className={styles.episodes}>
				{episodes.map(number => (
					<li key={number} className={styles.episode}>
						<span
							className={styles.episodeImage}
							style={{ backgroundColor: coverColor ?? undefined }}
						>
							{cover && <img src={cover} alt='' loading='lazy' />}
						</span>

						<span className={styles.episodeContent}>
							<span className={styles.episodeTitle}>
								{t('media.library.episode', { number })}
							</span>
							<span className={styles.episodePlaceholder}>
								<Skeleton width='70%' height='0.75rem' />
								<Skeleton width='45%' height='0.75rem' />
							</span>
						</span>
					</li>
				))}
			</ul>

			{total > shown && <p className={styles.libraryText}>{t('media.library.andMore')}</p>}
		</section>
	)
}
