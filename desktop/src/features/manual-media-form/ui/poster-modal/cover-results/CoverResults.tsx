import { useTranslation } from '@shared/i18n'
import { EmptyState } from '@shared/ui'

import type { CoverImage } from '@entities/media'

import type { CoverSelection } from '../../../lib/cover'
import styles from '../PosterModal.module.scss'

export interface CoverResultsProps {
	images: CoverImage[]
	disabled?: boolean
	onChoose: (selection: CoverSelection) => void
}

export function CoverResults({ images, disabled, onChoose }: CoverResultsProps) {
	const { t } = useTranslation()

	if (images.length === 0) {
		return (
			<EmptyState title={t('manualMedia.cover.empty')} description={t('manualMedia.cover.emptyHint')} />
		)
	}

	return (
		<ul className={styles.grid}>
			{images.map(image => (
				<li key={image.url}>
					<button
						type='button'
						className={styles.candidate}
						disabled={disabled}
						onClick={() =>
							onChoose({
								kind: 'url',
								value: image.url,
								previewUrl: image.thumbnail,
								source: 'search'
							})
						}
					>
						<img src={image.thumbnail} alt='' draggable={false} loading='lazy' />
					</button>
				</li>
			))}
		</ul>
	)
}
