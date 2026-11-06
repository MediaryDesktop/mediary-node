import { useRouter } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, ReelLoader } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { BookReaderView, bookStateQuery, loadBookFile, saveBookPositionMutation } from '@entities/reader'
import type { BookLocation } from '@entities/reader'

import { Panel } from './ui/panel/Panel'

const SAVE_DELAY = 1500

export interface ReadBookPageProps {
	fileId: number
}

export function ReadBookPage({ fileId }: ReadBookPageProps) {
	const { t } = useTranslation()
	const router = useRouter()

	const [state, stateError, statePending, loadState, savePosition, nodeReady] = useUnit([
		bookStateQuery.$data,
		bookStateQuery.$error,
		bookStateQuery.$pending,
		bookStateQuery.start,
		saveBookPositionMutation.start,
		$nodeReady
	])

	const [file, setFile] = useState<File | null>(null)
	const [fileFailed, setFileFailed] = useState(false)
	const [attempt, setAttempt] = useState(0)
	const [openedAt] = useState(() => performance.now())

	useEffect(() => {
		if (nodeReady) {
			loadState(fileId)
		}
	}, [fileId, loadState, nodeReady])

	const book = state?.book.file_id === fileId ? state.book : null

	const contentType = book?.content_type

	useEffect(() => {
		if (!contentType) {
			return
		}

		const controller = new AbortController()

		loadBookFile(fileId, contentType, controller.signal)
			.then(setFile)
			.catch(() => {
				if (!controller.signal.aborted) {
					setFileFailed(true)
				}
			})

		return () => controller.abort()
	}, [attempt, contentType, fileId])

	const pending = useRef<BookLocation | null>(null)
	const timer = useRef<number | undefined>(undefined)

	const flush = useCallback(() => {
		window.clearTimeout(timer.current)

		if (pending.current) {
			const { locator, fraction } = pending.current
			pending.current = null
			savePosition({ fileId, locator, fraction })
		}
	}, [fileId, savePosition])

	const onRelocate = useCallback(
		(location: BookLocation) => {
			pending.current = location
			window.clearTimeout(timer.current)
			timer.current = window.setTimeout(flush, SAVE_DELAY)
		},
		[flush]
	)

	useEffect(() => flush, [flush])

	const close = () => router.history.back()

	if (!book || !file) {
		if ((stateError && !statePending) || fileFailed) {
			return (
				<Panel onClose={close} openedAt={openedAt}>
					<p>{stateError?.body?.detail ?? t('reader.book.loadFailed')}</p>
					<Button
						onClick={() => {
							setFileFailed(false)
							setAttempt(current => current + 1)
							loadState(fileId)
						}}
					>
						{t('media.retry')}
					</Button>
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
		<BookReaderView
			book={book}
			file={file}
			locator={state?.position?.locator ?? null}
			openedAt={openedAt}
			onClose={close}
			onRelocate={onRelocate}
		/>
	)
}
