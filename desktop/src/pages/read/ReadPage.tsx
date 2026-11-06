import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, ReelLoader } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { chapterQuery, neighbourChapters, ReaderView } from '@entities/reader'

import { useTitleChapters } from '@features/title-chapters'

import { Panel } from './ui/panel/Panel'

export interface ReadPageProps {
	chapterRef: string
	onOpenChapter: (ref: string) => void
}

export function ReadPage({ chapterRef, onOpenChapter }: ReadPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const [chapterData, chapterError, chapterPending, loadChapter, nodeReady] = useUnit([
		chapterQuery.$data,
		chapterQuery.$error,
		chapterQuery.$pending,
		chapterQuery.start,
		$nodeReady
	])

	const [page, setPage] = useState(0)
	const [openedAt] = useState(() => performance.now())

	useEffect(() => {
		if (nodeReady) {
			loadChapter(chapterRef)
		}
	}, [chapterRef, loadChapter, nodeReady])

	const chapter = chapterData?.chapter.ref === chapterRef ? chapterData.chapter : null

	const { rows } = useTitleChapters(chapter?.media_ref)
	const neighbours = useMemo(() => neighbourChapters(rows, chapterRef), [rows, chapterRef])

	const close = () => router.history.back()

	if (!chapter) {
		if (chapterError && !chapterPending) {
			return (
				<Panel onClose={close} openedAt={openedAt}>
					<p>{problemDetail(chapterError, t('reader.loadFailed'))}</p>
					<Button onClick={() => loadChapter(chapterRef)}>{t('media.retry')}</Button>
				</Panel>
			)
		}

		return (
			<Panel onClose={close} openedAt={openedAt}>
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
			openedAt={openedAt}
			onClose={close}
			previous={neighbours.previous}
			next={neighbours.next}
			onOpenChapter={onOpenChapter}
		/>
	)
}
