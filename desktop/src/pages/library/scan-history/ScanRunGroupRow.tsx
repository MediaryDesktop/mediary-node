import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import type { LibraryScanRunGroup } from '@entities/library-item'

import styles from './ScanRunGroupRow.module.scss'

export interface ScanRunGroupRowProps {
	group: LibraryScanRunGroup
}

export function ScanRunGroupRow({ group }: ScanRunGroupRowProps) {
	const { t } = useTranslation()

	const cover = group.title?.cover_image
	const color = group.title?.cover_color
	const name = group.title?.title ?? group.media_ref

	const meta = [
		t('library.summary.files', { count: group.file_count }),
		!group.tracked ? t('library.history.notYetOnYourList') : null
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<li className={styles.row}>
			<span className={styles.poster} style={{ background: color ?? undefined }}>
				{cover ? (
					<img src={cover} alt='' loading='lazy' />
				) : (
					<Icon name='common/database' size={16} />
				)}
			</span>

			<div className={styles.body}>
				<p className={styles.title}>{name}</p>
				<p className={styles.meta}>{meta}</p>
			</div>
		</li>
	)
}
