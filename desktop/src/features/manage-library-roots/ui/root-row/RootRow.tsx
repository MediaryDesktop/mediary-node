import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon, MoreMenu } from '@shared/ui'

import { LIBRARY_CONTENT_ICONS, LIBRARY_CONTENTS } from '@entities/library-item'
import type { LibraryRoot } from '@entities/library-item'

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
				<Icon name={LIBRARY_CONTENT_ICONS[root.content]} size={20} />
			</span>

			<div className={styles.body}>
				<span className={styles.path} title={root.path}>
					{root.path}
				</span>

				<div className={styles.meta}>
					<Badge size='sm'>{t(`library.root.content.${root.content}`)}</Badge>
					<span className={styles.count}>
						{t('library.root.files', { count: root.file_count })}
					</span>

					{root.unmatched_count > 0 && (
						<Badge tone='warning' size='sm'>
							{t('library.summary.unmatched', { count: root.unmatched_count })}
						</Badge>
					)}

					{root.missing_count > 0 && (
						<Badge tone='danger' size='sm'>
							{t('library.root.missing', { count: root.missing_count })}
						</Badge>
					)}
				</div>
			</div>

			<MoreMenu
				label={t('library.root.menu')}
				items={[
					{
						id: 'rescan',
						label: t('library.root.rescan'),
						icon: <IoIosRefresh size={20} />,
						onSelect: onRescan
					},
					...LIBRARY_CONTENTS.map(content => ({
						id: `content-${content}`,
						label: t(`library.root.switchTo.${content}`),
						icon: LIBRARY_CONTENT_ICONS[content],
						checked: content === root.content,
						disabled: switching,
						onSelect: () => {
							if (content !== root.content) {
								onSwitch(content)
							}
						}
					})),
					{
						id: 'remove',
						label: t('library.root.remove'),
						icon: 'common/trash',
						danger: true,
						disabled: removing,
						onSelect: onRemove
					}
				]}
			/>
		</div>
	)
}
