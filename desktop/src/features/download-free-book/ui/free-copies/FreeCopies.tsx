import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import {
	bookDownloadSettingsQuery,
	bookDownloadsQuery,
	bookEditionsQuery,
	bookSourcesQuery,
	enqueueBookDownloadMutation,
	useBookFolderAction
} from '@entities/book-source'

import { EditionRow } from './edition-row/EditionRow'
import styles from './FreeCopies.module.scss'

export interface FreeCopiesProps {
	mediaRef: string
}

export function FreeCopies({ mediaRef }: FreeCopiesProps) {
	const { t } = useTranslation()

	const [sources, editions, searching, downloads] = useUnit([
		bookSourcesQuery.$data,
		bookEditionsQuery.$data,
		bookEditionsQuery.$pending,
		bookDownloadsQuery.$data
	])

	const navigate = useNavigate()
	const folderAction = useBookFolderAction(
		useCallback(() => void navigate({ to: '/settings', search: { section: 'books' } }), [navigate])
	)

	const anySource = (sources?.sources?.length ?? 0) > 0

	useNodeData(bookSourcesQuery)
	useNodeData(bookDownloadsQuery)
	useNodeData(bookDownloadSettingsQuery)

	useNodeData(bookEditionsQuery, { params: mediaRef, enabled: anySource })

	useUnitWatch(enqueueBookDownloadMutation.finished.success, () =>
		toast.success(t('bookSources.copies.queued'), { id: 'book-download-queued' })
	)
	useUnitWatch(enqueueBookDownloadMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('bookSources.copies.failedToQueue')), {
			id: 'book-download-failed',
			action: folderAction(error)
		})
	)

	if (!anySource) {
		return null
	}

	const current = editions?.mediaRef === mediaRef ? editions : null
	const found = current?.editions ?? []
	const failures = (current?.sources ?? []).filter(source => source.error)

	return (
		<section className={styles.section}>
			<div className={styles.heading}>
				<h2 className={styles.title}>{t('bookSources.copies.title')}</h2>
				<p className={styles.subtitle}>{t('bookSources.copies.subtitle')}</p>
			</div>

			{!current && searching && <p className={styles.note}>{t('bookSources.copies.searching')}</p>}

			{current && found.length === 0 && (
				<div className={styles.empty}>
					<p className={styles.emptyTitle}>{t('bookSources.copies.none')}</p>
					<p className={styles.note}>{t('bookSources.copies.noneHint')}</p>
				</div>
			)}

			{found.length > 0 && (
				<ul className={styles.list}>
					{found.map(edition => (
						<EditionRow
							key={edition.ref}
							edition={edition}
							mediaRef={mediaRef}
							downloads={downloads?.downloads ?? []}
						/>
					))}
				</ul>
			)}

			{failures.map(source => (
				<p key={source.id} className={styles.failure}>
					{t('bookSources.copies.sourceFailed', { name: source.name, error: source.error ?? '' })}
				</p>
			))}
		</section>
	)
}
