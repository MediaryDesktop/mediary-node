import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { isMatched } from '@entities/library-item'

import styles from './ExplorerRow.module.scss'
import type { FlatNode } from './lib/build-tree'

export interface ExplorerRowProps {
	row: FlatNode
	expanded: boolean
	selected: boolean
	onToggle: (key: string) => void
	onSelect: (row: FlatNode) => void
}

export function ExplorerRow({ row, expanded, selected, onToggle, onSelect }: ExplorerRowProps) {
	const { t } = useTranslation()
	const { node, depth } = row

	const folder = node.kind === 'folder'

	return (
		<button
			type='button'
			className={clsx(styles.row, selected && styles.selected)}
			style={{ paddingLeft: `${0.5 + depth * 1.125}rem` }}
			onClick={() => {
				onSelect(row)

				if (folder) {
					onToggle(node.key)
				}
			}}
		>
			<span className={styles.marker} aria-hidden>
				{folder ? (
					<Icon
						name='common/chevron-down'
						size={14}
						className={clsx(styles.chevron, !expanded && styles.collapsed)}
					/>
				) : null}
			</span>

			<Icon
				name={folder ? 'common/folder' : 'common/database'}
				size={15}
				className={clsx(styles.icon, !folder && node.file.ignored && styles.dim)}
			/>

			<span className={clsx(styles.name, !folder && node.file.ignored && styles.dim)}>{node.name}</span>

			{folder ? (
				<span className={styles.meta}>
					{t('library.explorer.folderMeta', { matched: node.matched, count: node.files })}
				</span>
			) : (
				<span className={styles.meta}>
					{node.file.missing
						? t('library.file.missing')
						: node.file.ignored
							? t('library.file.ignored')
							: isMatched(node.file)
								? t('library.group.matched')
								: t('library.group.unmatched')}
				</span>
			)}
		</button>
	)
}
