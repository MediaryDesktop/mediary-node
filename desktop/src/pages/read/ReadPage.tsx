import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, ReelLoader, WindowControls } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { titleFilesQuery } from '@entities/library-item'
import { mangaChaptersQuery } from '@entities/manga-source'
import { chapterQuery, localRef, neighbourChapters, ReaderView } from '@entities/reader'

import styles from './ReadPage.module.scss'

export interface ReadPageProps {
	chapterRef: string
	onOpenChapter: (ref: string) => void
}

export function ReadPage({ chapterRef, onOpenChapter }: ReadPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const [
		chapterData,
		chapterError,
		chapterPending,
		loadChapter,
		titleFiles,
		loadTitleFiles,
		onlineChapters,
		loadOnlineChapters,
		nodeReady
	] = useUnit([
		chapterQuery.$data,
		chapterQuery.$error,
		chapterQuery.$pending,
		chapterQuery.start,
		titleFilesQuery.$data,
		titleFilesQuery.start,
		mangaChaptersQuery.$data,
		mangaChaptersQuery.start,
		$nodeReady
	])

	// A chapter's neighbours come from where it came from: the library's files for a
	// local chapter, the linked series for an online one.
	const local = chapterRef.startsWith('local:')

	const [page, setPage] = useState(0)

	// A query sent before the node is up fails, and a reload of this page gets there first.
	useEffect(() => {
		if (nodeReady) {
			loadChapter(chapterRef)
		}
	}, [chapterRef, loadChapter, nodeReady])

	const chapter = chapterData?.chapter.ref === chapterRef ? chapterData.chapter : null
	const mediaRef = chapter?.media_ref

	useEffect(() => {
		if (!mediaRef || !nodeReady) {
			return
		}

		if (local) {
			loadTitleFiles({ mediaRef, kind: 'manga' })
		} else {
			loadOnlineChapters(mediaRef)
		}
	}, [mediaRef, local, loadTitleFiles, loadOnlineChapters, nodeReady])

	const neighbours = useMemo(() => {
		if (!local) {
			const online =
				(onlineChapters && onlineChapters.mediaRef === mediaRef ? onlineChapters.chapters : null) ??
				[]

			return neighbourChapters(
				online.map(item => ({ ref: item.ref, chapter: item.number ? Number(item.number) : null })),
				chapterRef
			)
		}

		const files = titleFiles?.files.items ?? []

		return neighbourChapters(
			files.map(file => ({ ref: localRef(file.id), chapter: file.match?.episode })),
			chapterRef
		)
	}, [local, onlineChapters, mediaRef, titleFiles, chapterRef])

	const close = () => router.history.back()

	if (!chapter) {
		if (chapterError && !chapterPending) {
			return (
				<Panel onClose={close}>
					<p>{chapterError.body?.detail ?? t('reader.loadFailed')}</p>
					<Button onClick={() => loadChapter(chapterRef)}>{t('media.retry')}</Button>
				</Panel>
			)
		}

		return (
			<Panel onClose={close}>
				<ReelLoader spinning />
			</Panel>
		)
	}

	return (
		<ReaderView
			key={chapterRef}
			chapter={chapter}
			page={page}
			onPageChange={setPage}
			onClose={close}
			previous={neighbours.previous}
			next={neighbours.next}
			onOpenChapter={onOpenChapter}
		/>
	)
}

function Panel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<header className={styles.top}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>
				<WindowControls className={styles.window} />
			</header>

			<div className={styles.body}>{children}</div>
		</div>
	)
}
