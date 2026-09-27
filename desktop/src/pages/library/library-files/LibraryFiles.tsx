import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'

import { deleteLibraryMatchMutation } from '@entities/library-item'
import type { LibraryFile, LibraryTitle } from '@entities/library-item'

import { groupFiles, titleIndex } from '../lib/library-view'
import type { LibraryLayout } from '../lib/library-view'

import styles from './LibraryFiles.module.scss'
import { TitleGroup } from './TitleGroup'

export interface LibraryFilesProps {
	files: LibraryFile[]
	titles: LibraryTitle[] | undefined
	layout: LibraryLayout
	playingFileID?: number
	onPlay: (file: LibraryFile) => void
	onMatch: (file: LibraryFile) => void
}

export function LibraryFiles({ files, titles, layout, playingFileID, onPlay, onMatch }: LibraryFilesProps) {
	const { t } = useTranslation()

	const clearMatch = useUnit(deleteLibraryMatchMutation.start)

	const groups = useMemo(
		() => groupFiles(files, titleIndex(titles), t('library.file.unknownTitle')),
		[files, titles, t]
	)

	return (
		<div className={styles.groups}>
			{groups.map(group => (
				<TitleGroup
					key={group.key}
					group={group}
					compact={layout === 'rows'}
					playingFileID={playingFileID}
					onPlay={onPlay}
					onMatch={onMatch}
					onClearMatch={file => clearMatch(file.id)}
				/>
			))}
		</div>
	)
}
