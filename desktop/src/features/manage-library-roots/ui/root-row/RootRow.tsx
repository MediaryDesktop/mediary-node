import { useTranslation } from '@shared/i18n'
import { Badge, Icon } from '@shared/ui'

import { LIBRARY_CONTENT_ICONS } from '@entities/library-item'
import type { LibraryRoot } from '@entities/library-item'

import { RootMenu } from './RootMenu'
import styles from './RootRow.module.scss'

export interface RootRowProps {
	root: LibraryRoot
	onRescan: () => void
	onSwitch: (content: LibraryRoot['content']) => void
	onRemove: () => void
	switching: boolean
	removing: boolean
}

export function RootRow({ root, onRescan, onSwitch, onRemove, switching, removing }: RootRowProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.row}>
			<span className={styles.badge}>
				<Icon name={LIBRARY_CONTENT_ICONS[root.content]} size={24} />
			</span>

			<div className={styles.body}>
				<span className={styles.path} title={root.path}>
					{root.path}
				</span>

				<div className={styles.meta}>
					<Badge tone='accent' size='sm'>{t(`library.root.content.${root.content}`)}</Badge>

					{root.unmatched_count > 0 && (
						<Badge tone='warning' size='sm'>
							{t('library.summary.unmatched', { count: root.unmatched_count })}
						</Badge>
					)}

					<span className={styles.count}>
						{t('library.root.files', { count: root.file_count })}
					</span>

					{root.missing_count > 0 && (
						<Badge tone='danger' size='sm'>
							{t('library.root.missing', { count: root.missing_count })}
						</Badge>
					)}
				</div>
			</div>

			<RootMenu
				root={root}
				onRescan={onRescan}
				onSwitch={onSwitch}
				onRemove={onRemove}
				switching={switching}
				removing={removing}
			/>
		</div>
	)
}
