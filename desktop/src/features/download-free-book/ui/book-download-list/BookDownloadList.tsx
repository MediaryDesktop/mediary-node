import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, useUnitWatch } from '@shared/lib'
import { Button, Icon, ProgressBar, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	bookDownloadsQuery,
	cancelBookDownloadMutation,
	forgetBookDownloadMutation,
	retryBookDownloadMutation
} from '@entities/book-source'
import type { BookDownload } from '@entities/book-source'

import styles from './BookDownloadList.module.scss'

// The books queue and what it saved, newest first. The node pushes every change,
// so the list moves while a book downloads.
export function BookDownloadList() {
	const { t } = useTranslation()

	const [data, load, cancel, retry, forget, nodeReady] = useUnit([
		bookDownloadsQuery.$data,
		bookDownloadsQuery.start,
		cancelBookDownloadMutation.start,
		retryBookDownloadMutation.start,
		forgetBookDownloadMutation.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('bookSources.downloads.actionFailed')), {
			id: 'book-download-action'
		})

	useUnitWatch(cancelBookDownloadMutation.finished.failure, failed)
	useUnitWatch(retryBookDownloadMutation.finished.failure, failed)
	useUnitWatch(forgetBookDownloadMutation.finished.failure, failed)

	const downloads = data?.downloads ?? []

	if (downloads.length === 0) {
		return <p className={styles.empty}>{t('bookSources.downloads.empty')}</p>
	}

	return (
		<ul className={styles.list}>
			{downloads.map(item => (
				<DownloadRow
					key={item.id}
					item={item}
					onCancel={() => cancel(item.id)}
					onRetry={() => retry(item.id)}
					onForget={() => forget(item.id)}
				/>
			))}
		</ul>
	)
}

interface DownloadRowProps {
	item: BookDownload
	onCancel: () => void
	onRetry: () => void
	onForget: () => void
}

function DownloadRow({ item, onCancel, onRetry, onForget }: DownloadRowProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const active = item.state === 'queued' || item.state === 'running'
	const name = item.authors ? `${item.authors} — ${item.title}` : item.title

	return (
		<li className={clsx(styles.row, styles[item.state])}>
			<div className={styles.body}>
				<p className={styles.name} title={name}>
					{name}
				</p>
				<p className={styles.meta}>
					<span className={styles.state}>{t(`bookSources.downloads.states.${item.state}`)}</span>
					{item.state === 'running' && item.bytes_done > 0 && (
						<>
							{' '}
							·{' '}
							{item.bytes_total > 0
								? `${formatBytes(item.bytes_done)} / ${formatBytes(item.bytes_total)}`
								: formatBytes(item.bytes_done)}
						</>
					)}
					{item.source_name && <> · {item.source_name}</>}
					{item.state === 'done' && item.rel_path && <> · {item.rel_path}</>}
				</p>
				{item.state === 'failed' && item.error && <p className={styles.error}>{item.error}</p>}
				{item.state === 'running' && item.bytes_total > 0 && (
					<ProgressBar value={item.bytes_done} max={item.bytes_total} />
				)}
			</div>

			<div className={styles.actions}>
				{item.state === 'done' && item.file_id && (
					<Button
						size='small'
						variant='primary'
						startIcon={<Icon name='common/book-open' size={16} />}
						onClick={() =>
							void navigate({
								to: '/read-book/$fileId',
								params: { fileId: String(item.file_id) }
							})
						}
					>
						{t('reader.book.read')}
					</Button>
				)}
				{active && (
					<Button size='small' variant='ghost' onClick={onCancel}>
						{t('bookSources.downloads.cancel')}
					</Button>
				)}
				{(item.state === 'failed' || item.state === 'cancelled') && (
					<Button size='small' startIcon={<IoIosRefresh size={14} />} onClick={onRetry}>
						{t('bookSources.downloads.retry')}
					</Button>
				)}
				{!active && (
					<Button
						size='small'
						variant='ghost'
						iconOnly
						aria-label={t('bookSources.downloads.forget')}
						title={t('bookSources.downloads.forget')}
						startIcon={<Icon name='common/close' size={14} />}
						onClick={onForget}
					/>
				)}
			</div>
		</li>
	)
}
