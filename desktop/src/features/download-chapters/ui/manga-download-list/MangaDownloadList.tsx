import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, ProgressBar, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	cancelMangaDownloadMutation,
	forgetMangaDownloadMutation,
	mangaDownloadsQuery,
	retryMangaDownloadMutation
} from '@entities/manga-source'
import type { MangaDownload } from '@entities/manga-source'

import styles from './MangaDownloadList.module.scss'

export interface MangaDownloadListProps {
	hideTitle?: boolean
}

export function MangaDownloadList({ hideTitle }: MangaDownloadListProps = {}) {
	const { t } = useTranslation()

	const [data, load, cancel, retry, forget, nodeReady] = useUnit([
		mangaDownloadsQuery.$data,
		mangaDownloadsQuery.start,
		cancelMangaDownloadMutation.start,
		retryMangaDownloadMutation.start,
		forgetMangaDownloadMutation.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('mangaSources.downloads.failedToQueue')), {
			id: 'manga-download-action'
		})

	useUnitWatch(cancelMangaDownloadMutation.finished.failure, failed)
	useUnitWatch(retryMangaDownloadMutation.finished.failure, failed)
	useUnitWatch(forgetMangaDownloadMutation.finished.failure, failed)

	const downloads = data?.downloads ?? []

	return (
		<section className={styles.root}>
			{!hideTitle && <h2 className={styles.title}>{t('mangaSources.downloads.title')}</h2>}

			{downloads.length === 0 ? (
				<p className={styles.empty}>{t('mangaSources.downloads.empty')}</p>
			) : (
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
			)}
		</section>
	)
}

interface DownloadRowProps {
	item: MangaDownload
	onCancel: () => void
	onRetry: () => void
	onForget: () => void
}

function DownloadRow({ item, onCancel, onRetry, onForget }: DownloadRowProps) {
	const { t } = useTranslation()

	const active = item.state === 'queued' || item.state === 'running'
	const name = item.number
		? `${item.series} · ${t('reader.chapterNumber', { number: item.number })}`
		: item.title

	return (
		<li className={clsx(styles.row, styles[item.state])}>
			<div className={styles.body}>
				<p className={styles.name}>{name}</p>
				<p className={styles.meta}>
					<span className={styles.state}>{t(`mangaSources.downloads.states.${item.state}`)}</span>
					{item.state === 'running' && item.pages_total > 0 && (
						<>
							{' '}
							·{' '}
							{t('mangaSources.downloads.progress', {
								done: item.pages_done,
								total: item.pages_total
							})}
						</>
					)}
					{item.source_name && <> · {item.source_name}</>}
					{item.state === 'done' && item.rel_path && <> · {item.rel_path}</>}
				</p>
				{item.state === 'failed' && item.error && <p className={styles.error}>{item.error}</p>}
				{item.state === 'running' && item.pages_total > 0 && (
					<ProgressBar value={item.pages_done} max={item.pages_total} />
				)}
			</div>

			<div className={styles.actions}>
				{active && (
					<Button size='small' variant='ghost' onClick={onCancel}>
						{t('mangaSources.downloads.cancel')}
					</Button>
				)}
				{(item.state === 'failed' || item.state === 'cancelled') && (
					<Button size='small' startIcon={<IoIosRefresh size={14} />} onClick={onRetry}>
						{t('mangaSources.downloads.retry')}
					</Button>
				)}
				{!active && (
					<Button
						size='small'
						variant='ghost'
						iconOnly
						aria-label={t('mangaSources.downloads.forget')}
						title={t('mangaSources.downloads.forget')}
						startIcon={<Icon name='common/close' size={14} />}
						onClick={onForget}
					/>
				)}
			</div>
		</li>
	)
}
