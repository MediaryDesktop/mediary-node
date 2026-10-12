import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, ReelLoader } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { chapterQuery, neighbourChapters, ReaderView } from '@entities/reader'

import { useTitleChapters } from '@features/title-chapters'

import { Panel } from './Panel'

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

	// A query sent before the node is up fails, and a reload of this page gets there first.
	useEffect(() => {
		if (nodeReady) {
			loadChapter(chapterRef)
		}
	}, [chapterRef, loadChapter, nodeReady])

	const chapter = chapterData?.chapter.ref === chapterRef ? chapterData.chapter : null

	// The same list as the title page, so the next chapter may come from another
	// source than this one: after a local 12, the server's 13.
	const { rows } = useTitleChapters(chapter?.media_ref)
	const neighbours = useMemo(() => neighbourChapters(rows, chapterRef), [rows, chapterRef])

	const close = () => router.history.back()

	if (!chapter) {
		if (chapterError && !chapterPending) {
			return (
				<Panel onClose={close}>
					<p>{problemDetail(chapterError, t('reader.loadFailed'))}</p>
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
