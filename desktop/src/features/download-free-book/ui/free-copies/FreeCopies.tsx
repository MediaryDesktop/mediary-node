import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, useUnitWatch } from '@shared/lib'
import { Button, Icon, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	bookDownloadsQuery,
	bookEditionsQuery,
	bookSourcesQuery,
	enqueueBookDownloadMutation,
	retryBookDownloadMutation
} from '@entities/book-source'
import type { BookDownload, BookEdition, BookFormat } from '@entities/book-source'

import { downloadRequested } from '../../model/model'

import styles from './FreeCopies.module.scss'

export interface FreeCopiesProps {
	mediaRef: string
}

// Free copies of this book in the sources the user turned on: Project
// Gutenberg's public domain, and their own OPDS servers. Not shown at all while
// no source is on, so a book page does not advertise an empty search.
export function FreeCopies({ mediaRef }: FreeCopiesProps) {
	const { t } = useTranslation()

	const [sources, loadSources, editions, loadEditions, searching, downloads, loadDownloads, nodeReady] =
		useUnit([
			bookSourcesQuery.$data,
			bookSourcesQuery.start,
			bookEditionsQuery.$data,
			bookEditionsQuery.start,
			bookEditionsQuery.$pending,
			bookDownloadsQuery.$data,
			bookDownloadsQuery.start,
			$nodeReady
		])

	const anySource = (sources?.sources?.length ?? 0) > 0

	useEffect(() => {
		if (nodeReady) {
			loadSources()
			loadDownloads()
		}
	}, [loadSources, loadDownloads, nodeReady])

	useEffect(() => {
		if (nodeReady && anySource) {
			loadEditions(mediaRef)
		}
	}, [mediaRef, loadEditions, anySource, nodeReady])

	useUnitWatch(enqueueBookDownloadMutation.finished.success, () =>
		toast.success(t('bookSources.copies.queued'), { id: 'book-download-queued' })
	)
	useUnitWatch(enqueueBookDownloadMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('bookSources.copies.failedToQueue')), {
			id: 'book-download-failed'
		})
	)

	if (!anySource) {
		return null
	}

	// Shared with the other book pages, so it may still be another book's answer.
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

interface EditionRowProps {
	edition: BookEdition
	mediaRef: string
	downloads: BookDownload[]
}

function EditionRow({ edition, mediaRef, downloads }: EditionRowProps) {
	const meta = [
		(edition.authors ?? []).join(', '),
		edition.source,
		edition.language?.toUpperCase(),
		edition.year ? String(edition.year) : ''
	].filter(Boolean)

	return (
		<li className={styles.row}>
			<span className={styles.icon} aria-hidden>
				<Icon name='categories/book' size={18} />
			</span>

			<div className={styles.body}>
				<p className={styles.name} title={edition.title}>
					{edition.title}
				</p>
				<span className={styles.meta}>{meta.join(' · ')}</span>
			</div>

			<div className={styles.formats}>
				{(edition.formats ?? []).map(format => (
					<FormatAction
						key={format.type}
						edition={edition}
						format={format}
						mediaRef={mediaRef}
						download={downloads.find(
							item => item.edition_ref === edition.ref && item.format === format.type
						)}
					/>
				))}
			</div>
		</li>
	)
}

interface FormatActionProps {
	edition: BookEdition
	format: BookFormat
	mediaRef: string
	// This copy in this format in the queue, if it was asked for before.
	download: BookDownload | undefined
}

function FormatAction({ edition, format, mediaRef, download }: FormatActionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [request, retry, queueing] = useUnit([
		downloadRequested,
		retryBookDownloadMutation.start,
		enqueueBookDownloadMutation.$pending
	])

	const label = [format.ext.replace('.', '').toUpperCase(), format.size ? formatBytes(format.size) : '']
		.filter(Boolean)
		.join(' · ')

	if (download?.state === 'done' && download.file_id) {
		const fileId = String(download.file_id)

		return (
			<Button
				size='small'
				variant='primary'
				startIcon={<Icon name='common/book-open' size={16} />}
				onClick={() => void navigate({ to: '/read-book/$fileId', params: { fileId } })}
			>
				{t('reader.book.read')}
			</Button>
		)
	}

	if (download?.state === 'queued' || download?.state === 'running') {
		const percent =
			download.bytes_total > 0 ? Math.round((download.bytes_done / download.bytes_total) * 100) : null

		return (
			<Button size='small' disabled>
				{percent === null
					? t(`bookSources.downloads.states.${download.state}`)
					: t('bookSources.copies.saving', { percent })}
			</Button>
		)
	}

	if (download?.state === 'failed' || download?.state === 'cancelled') {
		return (
			<Button
				size='small'
				startIcon={<IoIosRefresh size={14} />}
				title={download.error}
				onClick={() => retry(download.id)}
			>
				{t('bookSources.copies.retry', { format: label })}
			</Button>
		)
	}

	return (
		<Button
			size='small'
			startIcon={<Icon name='common/download' size={16} />}
			disabled={queueing}
			onClick={() => request({ edition_ref: edition.ref, format: format.type, media_ref: mediaRef })}
		>
			{label}
		</Button>
	)
}
