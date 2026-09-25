import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { deleteLibraryMatchMutation, LibraryFileRow } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { groupFiles } from '../lib/library-view'

import styles from './LibraryFiles.module.scss'

export interface LibraryFilesProps {
	files: LibraryFile[]
	onMatch: (file: LibraryFile) => void
}

export function LibraryFiles({ files, onMatch }: LibraryFilesProps) {
	const { t } = useTranslation()

	const clearMatch = useUnit(deleteLibraryMatchMutation.start)

	const groups = useMemo(() => groupFiles(files, t('library.file.unknownTitle')), [files, t])

	return (
		<div className={styles.groups}>
			{groups.map(group => (
				<section key={group.key} className={styles.group}>
					<header className={styles.heading}>
						<h3 className={styles.title}>{group.title}</h3>
						<span className={styles.count}>
							{t('library.summary.files', { count: group.files.length })}
						</span>
					</header>

					<div className={styles.rows}>
						{group.files.map(file => (
							<LibraryFileRow
								key={file.id}
								file={file}
								onMatch={onMatch}
								onClearMatch={target => clearMatch(target.id)}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	)
}
