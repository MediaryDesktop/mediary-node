import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Checkbox, Icon } from '@shared/ui'
import type { CheckboxState } from '@shared/ui'

import { isMatched } from '@entities/library-item'

import type { FlatNode } from '../../lib/build-tree'

import styles from './ExplorerRow.module.scss'

export interface ExplorerRowProps {
	row: FlatNode
	expanded: boolean
	focused: boolean
	selecting: boolean
	checked: CheckboxState
	title?: string

	onToggle: (key: string) => void
	onFocus: (row: FlatNode) => void
	onCheck: (row: FlatNode, checked: boolean) => void
}

export function ExplorerRow({
	row,
	expanded,
	focused,
	selecting,
	checked,
	title,
	onToggle,
	onFocus,
	onCheck
}: ExplorerRowProps) {
	const { t } = useTranslation()
	const { node, depth } = row

	const folder = node.kind === 'folder'
	const file = folder ? null : node.file

	return (
		<div
			role='treeitem'
			aria-expanded={folder ? expanded : undefined}
			aria-selected={focused}
			tabIndex={0}
			className={clsx(styles.row, focused && styles.focused)}
			style={{ paddingLeft: `${0.5 + depth * 1.125}rem` }}
			onClick={() => {
				onFocus(row)

				if (folder) {
					onToggle(node.key)
				}
			}}
			onKeyDown={event => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					onFocus(row)

					if (folder) {
						onToggle(node.key)
					}
				}
			}}
		>
			<span className={styles.marker} aria-hidden>
				{folder && (
					<Icon
						name='common/chevron-down'
						size={14}
						className={clsx(styles.chevron, !expanded && styles.collapsed)}
					/>
				)}
			</span>

			{selecting && (
				<Checkbox
					checked={checked}
					label={t('library.explorer.selectRow', { name: node.name })}
					onCheckedChange={next => onCheck(row, next)}
				/>
			)}

			<Icon
				name={folder ? 'common/folder' : 'common/database'}
				size={15}
				className={clsx(styles.icon, file?.ignored && styles.dim)}
			/>

			<span className={clsx(styles.name, file?.ignored && styles.dim)}>{node.name}</span>

			{title && <span className={styles.chip}>{title}</span>}

			<span className={styles.spacer} />

			{folder ? (
				<span className={styles.meta}>
					{t('library.explorer.folderMeta', { matched: node.matched, count: node.files })}
				</span>
			) : (
				<span
					className={clsx(
						styles.state,
						file?.missing
							? styles.missing
							: file && isMatched(file)
								? styles.matched
								: styles.unmatched
					)}
				>
					<Icon
						name={
							file?.missing
								? 'common/close'
								: file && isMatched(file)
									? 'common/check'
									: 'common/info'
						}
						size={13}
					/>

					{file?.missing
						? t('library.file.missing')
						: file?.ignored
							? t('library.file.ignored')
							: file && isMatched(file)
								? t('library.group.matched')
								: t('library.group.unmatched')}
				</span>
			)}
		</div>
	)
}
