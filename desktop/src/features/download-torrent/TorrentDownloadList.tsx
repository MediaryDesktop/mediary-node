import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatDuration } from '@shared/lib'
import { Button, DropdownMenu, Icon, ProgressBar, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	pauseTorrentMutation,
	removeTorrentMutation,
	resumeTorrentMutation,
	torrentDownloadsQuery
} from '@entities/torrent'
import type { TorrentDownload } from '@entities/torrent'

import { displayState } from './lib/display-state'
import styles from './TorrentDownloadList.module.scss'

export interface TorrentDownloadListProps {
	// Only this title's downloads; all of them when left out.
	mediaRef?: string
	// Leaves the heading to a page that has its own.
	hideTitle?: boolean
}

// Torrents the node added to qBittorrent, newest first. The node polls the client
// and announces each change, so the list moves while a torrent downloads.
export function TorrentDownloadList({ mediaRef, hideTitle }: TorrentDownloadListProps) {
	const { t } = useTranslation()

	const [data, load, pause, resume, remove, nodeReady] = useUnit([
		torrentDownloadsQuery.$data,
		torrentDownloadsQuery.start,
		pauseTorrentMutation.start,
		resumeTorrentMutation.start,
		removeTorrentMutation.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useEffect(() => {
		const failed = ({ error }: { error: { body?: { detail?: string } | null } }) =>
			toast.error(error.body?.detail ?? t('torrents.actionFailed'), { id: 'torrent-action' })

		const stop = [
			pauseTorrentMutation.finished.failure.watch(failed),
			resumeTorrentMutation.finished.failure.watch(failed),
			removeTorrentMutation.finished.failure.watch(failed)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const client = data?.client
	const downloads = (data?.downloads ?? []).filter(item => !mediaRef || item.media_ref === mediaRef)

	return (
		<section className={styles.root}>
			{!hideTitle && <h2 className={styles.title}>{t('torrents.list.title')}</h2>}

			{client && !client.configured && (
				<p className={styles.notice}>
					{t('torrents.client.notConfigured')}{' '}
					<Link to='/settings' className={styles.link}>
						{t('torrents.client.openSettings')}
					</Link>
				</p>
			)}

			{client?.configured && !client.reachable && client.error && (
				<p className={clsx(styles.notice, styles.problem)}>
					{t('torrents.client.unreachable', { error: client.error })}
				</p>
			)}

			{downloads.length === 0 ? (
				<p className={styles.empty}>
					{mediaRef ? t('torrents.list.emptyForTitle') : t('torrents.list.empty')}
				</p>
			) : (
				<ul className={styles.list}>
					{downloads.map(item => (
						<DownloadRow
							key={item.id}
							item={item}
							showTitle={!mediaRef}
							onPause={() => pause(item.id)}
							onResume={() => resume(item.id)}
							onRemove={withFiles => remove({ id: item.id, withFiles })}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

interface DownloadRowProps {
	item: TorrentDownload
	showTitle: boolean
	onPause: () => void
	onResume: () => void
	onRemove: (withFiles: boolean) => void
}

function DownloadRow({ item, showTitle, onPause, onResume, onRemove }: DownloadRowProps) {
	const { t } = useTranslation()

	const state = displayState(item)
	const live = item.live
	const downloading = item.state === 'downloading'

	const meta: string[] = []

	if (showTitle && item.name && item.name !== item.title) {
		meta.push(item.title)
	}
	if (downloading && live) {
		if (live.size > 0) {
			meta.push(`${formatBytes(live.size * live.progress)} / ${formatBytes(live.size)}`)
		}
		if (!live.paused && live.dl_speed > 0) {
			meta.push(t('torrents.meta.speed', { speed: formatBytes(live.dl_speed) }))
		}
		if (!live.paused) {
			meta.push(t('torrents.meta.seeds', { seeds: live.seeds, peers: live.peers }))
		}
		if (!live.paused && live.eta) {
			meta.push(t('torrents.meta.eta', { time: formatDuration(live.eta) }))
		}
	}
	if (item.state === 'done') {
		meta.push(t('torrents.meta.imported', { count: item.imported }))
	}

	return (
		<li className={clsx(styles.row, styles[item.state])}>
			<div className={styles.body}>
				<p className={styles.name} title={item.name || item.title}>
					{item.name || item.title}
				</p>
				<p className={styles.meta}>
					<span className={styles.state}>{t(`torrents.states.${state}`)}</span>
					{meta.map(part => (
						<span key={part}> · {part}</span>
					))}
				</p>
				{item.state === 'failed' && item.error && <p className={styles.error}>{item.error}</p>}
				{downloading && live && <ProgressBar value={live.progress * 100} max={100} />}
			</div>

			<div className={styles.actions}>
				{downloading && live && (
					<Button
						size='small'
						variant='ghost'
						iconOnly
						aria-label={live.paused ? t('torrents.resume') : t('torrents.pause')}
						title={live.paused ? t('torrents.resume') : t('torrents.pause')}
						startIcon={<Icon name={live.paused ? 'common/play' : 'common/pause'} size={14} />}
						onClick={live.paused ? onResume : onPause}
					/>
				)}

				<DropdownMenu
					items={[
						{
							id: 'remove',
							label: t('torrents.remove'),
							icon: 'common/close',
							onSelect: () => onRemove(false)
						},
						{
							id: 'remove-files',
							label: t('torrents.removeWithFiles'),
							icon: 'common/trash',
							danger: true,
							onSelect: () => onRemove(true)
						}
					]}
					trigger={
						<button type='button' className={styles.menu} aria-label={t('torrents.menu')}>
							<Icon name='common/more-vertical' size={16} />
						</button>
					}
				/>
			</div>
		</li>
	)
}
