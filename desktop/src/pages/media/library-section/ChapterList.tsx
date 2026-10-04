import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { fileName, fileTitle, titleFilesQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { episodeNumber, groupTitleFiles, isWatched } from '../lib/episodes'

import styles from './ChapterList.module.scss'

export interface ChapterListProps {
	mediaRef: string
	progress: number
	coverColor: string | null
}

export function ChapterList({ mediaRef, progress, coverColor }: ChapterListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [data, load, nodeReady] = useUnit([titleFilesQuery.$data, titleFilesQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load({ mediaRef, kind: 'manga' })
		}
	}, [mediaRef, load, nodeReady])

	const files = (data?.files.items ?? []).filter(file => file.match?.media_ref === mediaRef)

	if (files.length === 0) {
		return null
	}

	const chapters = groupTitleFiles(files, progress).main

	const open = (file: LibraryFile) => {
		void navigate({ to: '/read/$fileId', params: { fileId: String(file.id) } })
	}

	return (
		<section className={styles.section}>
			<h2 className={styles.title}>{t('media.chapters.title', { count: chapters.length })}</h2>

			<ul className={styles.list}>
				{chapters.map(file => (
					<ChapterRow
						key={file.id}
						file={file}
						read={isWatched(file, progress)}
						accent={coverColor}
						onOpen={open}
					/>
				))}
			</ul>
		</section>
	)
}

interface ChapterRowProps {
	file: LibraryFile
	read: boolean
	accent: string | null
	onOpen: (file: LibraryFile) => void
}

function ChapterRow({ file, read, accent, onOpen }: ChapterRowProps) {
	const { t } = useTranslation()
	const number = episodeNumber(file)

	return (
		<li>
			<button
				type='button'
				className={clsx(styles.row, read && styles.read)}
				style={accent ? ({ '--accent-chapter': accent } as CSSProperties) : undefined}
				onClick={() => onOpen(file)}
			>
				<span className={styles.number}>
					{number === null ? '—' : t('reader.chapterNumber', { number })}
				</span>
				<span className={styles.name}>
					<span className={styles.nameText}>{fileTitle(file)}</span>
					<span className={styles.file}>{fileName(file)}</span>
				</span>
				{read ? (
					<Badge tone='success'>{t('reader.read')}</Badge>
				) : (
					<Icon name='common/book-open' size={18} className={styles.open} />
				)}
			</button>
		</li>
	)
}
