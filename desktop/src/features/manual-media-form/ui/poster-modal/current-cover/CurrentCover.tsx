import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon } from '@shared/ui'

import type { CoverSelection } from '../../../lib/cover'

import styles from './CurrentCover.module.scss'

export interface CurrentCoverProps {
	previewUrl: string
	selection: CoverSelection
	onRemove?: () => void
}

export function CurrentCover({ previewUrl, selection, onRemove }: CurrentCoverProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.current}>
			<img src={previewUrl} alt='' draggable={false} className={styles.currentThumb} />

			<span className={styles.currentInfo}>
				<span className={styles.currentLabel}>{t('manualMedia.cover.current')}</span>
				<span className={styles.currentName}>
					{selection.kind === 'data'
						? `${selection.name} · ${formatBytes(selection.size)}`
						: t(
								selection.kind === 'url' && selection.source === 'search'
									? 'manualMedia.cover.fromSearch'
									: 'manualMedia.cover.fromUrl'
							)}
				</span>
			</span>

			{onRemove && (
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/trash' size={14} />}
					onClick={onRemove}
				>
					{t('manualMedia.cover.remove')}
				</Button>
			)}
		</div>
	)
}
