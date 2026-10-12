import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Icon, useRipple } from '@shared/ui'

import type { LibrarySuggestion } from '@entities/library-item'

import styles from './SuggestionCard.module.scss'

// A title the matcher thinks the folder is; picking it fills in its id.
export interface SuggestionCardProps {
	suggestion: LibrarySuggestion
	chosen: boolean
	onClick: () => void
}

export function SuggestionCard({ suggestion, chosen, onClick }: SuggestionCardProps) {
	const { t } = useTranslation()
	const ripple = useRipple<HTMLButtonElement>()

	return (
		<button
			ref={ripple}
			type='button'
			role='radio'
			aria-checked={chosen}
			className={clsx(styles.card, chosen && styles.chosen)}
			onClick={onClick}
		>
			<span className={styles.poster} style={{ backgroundColor: suggestion.cover_color ?? undefined }}>
				{suggestion.cover_image && <img src={suggestion.cover_image} alt='' loading='lazy' />}
			</span>

			<span className={styles.cardText}>
				<span className={styles.cardTitle}>{suggestion.title}</span>

				<span className={styles.cardMeta}>
					{[
						suggestion.format,
						suggestion.year ? String(suggestion.year) : null,
						t('library.unmatched.confidence', {
							percent: Math.round(suggestion.confidence * 100)
						})
					]
						.filter(Boolean)
						.join(' · ')}
				</span>
			</span>

			{suggestion.tracked && (
				<span className={styles.tracked}>
					<Icon name='common/list' size={12} />
					{t('library.unmatched.onYourList')}
				</span>
			)}
		</button>
	)
}
