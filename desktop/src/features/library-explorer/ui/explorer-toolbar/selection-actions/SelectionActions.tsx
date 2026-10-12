import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import {
	deleteLibraryMatchesMutation,
	isMatched,
	setLibraryFilesIgnoredMutation
} from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import styles from './SelectionActions.module.scss'

export interface SelectionActionsProps {
	chosen: LibraryFile[]
	onMatchMany: (files: LibraryFile[]) => void
	onDelete: () => void
	// After an action that is done with the selection.
	onDone: () => void
}

// What can be done to the ticked files at once. Each action flips: matching what is
// matched unmatches it, ignoring what is ignored brings it back.
export function SelectionActions({ chosen, onMatchMany, onDelete, onDone }: SelectionActionsProps) {
	const { t } = useTranslation()
	const [unmatchFiles, ignoreFiles] = useUnit([
		deleteLibraryMatchesMutation.start,
		setLibraryFilesIgnoredMutation.start
	])

	const count = chosen.length
	const allMatched = count > 0 && chosen.every(isMatched)
	const allIgnored = count > 0 && chosen.every(file => file.ignored)

	return (
		<span className={styles.actions}>
			<Button
				variant='ghost'
				size='small'
				startIcon={<Icon name='common/link' size={16} />}
				className={allMatched ? styles.warning : styles.success}
				onClick={() => {
					if (allMatched) {
						unmatchFiles(chosen.map(file => file.id))
					} else {
						onMatchMany(chosen)
					}

					onDone()
				}}
			>
				{allMatched
					? t('library.explorer.unmatchFiles', { count })
					: t('library.explorer.matchFiles', { count })}
			</Button>

			<Button
				variant='ghost'
				size='small'
				startIcon={<Icon name={allIgnored ? 'common/eye' : 'common/eye-off'} size={16} />}
				onClick={() => {
					ignoreFiles(chosen.map(file => ({ fileId: file.id, ignored: !allIgnored })))
					onDone()
				}}
			>
				{allIgnored
					? t('library.explorer.unignoreFiles', { count })
					: t('library.explorer.ignoreFiles', { count })}
			</Button>

			<Button
				variant='secondary'
				size='small'
				startIcon={<Icon name='common/trash' size={16} />}
				className={styles.danger}
				onClick={onDelete}
			>
				{t('library.explorer.deleteFiles', { count })}
			</Button>
		</span>
	)
}
