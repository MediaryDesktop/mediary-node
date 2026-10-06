import { Link, useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatDuration } from '@shared/lib'
import { Badge, Button, DropdownMenu, EmptyState, Icon, ProgressBar, toast } from '@shared/ui'
import type { BadgeTone } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	pauseTorrentMutation,
	removeTorrentMutation,
	resumeTorrentMutation,
	torrentDownloadsQuery,
	TorrentSetupNotice,
	useTorrentSetup
} from '@entities/torrent'
import type { TorrentDownload } from '@entities/torrent'

import { displayState } from './lib/display-state'
import type { TorrentDisplayState } from './lib/display-state'
import { $filesFor, filesDismissed, filesRequested } from './model'
import styles from './TorrentDownloadList.module.scss'
import { TorrentFilesDrawer } from './TorrentFilesDrawer'

export interface TorrentDownloadListProps {
	// Only this title's downloads; all of them, with a summary, when left out.
	mediaRef?: string
}

const STATE_TONE: Record<TorrentDisplayState, BadgeTone> = {
	choosing: 'warning',
	downloading: 'success',
	paused: 'neutral',
	stalled: 'neutral',
	queued: 'neutral',
	checking: 'info',
	metadata: 'info',
	error: 'danger',
	importing: 'info',
	done: 'success',
	failed: 'danger',
	unknown: 'neutral'
}

// Torrents the node added to its client, newest first. The node polls the client
// and announces each change, so the list moves while a torrent downloads.
export function TorrentDownloadList({ mediaRef }: TorrentDownloadListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [data, load, pause, resume, remove, nodeReady, filesFor, requestFiles, dismissFiles] = useUnit([
		torrentDownloadsQuery.$data,
		torrentDownloadsQuery.start,
		pauseTorrentMutation.start,
		resumeTorrentMutation.start,
		removeTorrentMutation.start,
		$nodeReady,
		$filesFor,
		filesRequested,
		filesDismissed
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

	const downloads = (data?.downloads ?? []).filter(item => !mediaRef || item.media_ref === mediaRef)

	// Only the list that shows the download hosts the choice, so a page with two
	// lists does not open it twice.
	const choosing = downloads.find(item => item.id === filesFor) ?? null

	const states = downloads.map(displayState)
	const active = states.filter(state => state !== 'done' && state !== 'failed').length
	const inLibrary = states.filter(state => state === 'done').length

	return (
		<section className={styles.root}>
			<TorrentSetupNotice setup={setup} onOpenSettings={() => navigate({ to: '/settings' })} />

			{!mediaRef && downloads.length > 0 && (
				<div className={styles.summary}>
					<span>{t('torrents.list.active', { count: active })}</span>
					<span>{t('torrents.list.inLibrary', { count: inLibrary })}</span>
					{setup.clientConfigured && (
						<span className={styles.client}>
							<span
								className={clsx(
									styles.dot,
									setup.clientReachable === false
										? styles.down
										: setup.clientReachable && styles.up
								)}
							/>
							{setup.clientKind === 'embedded'
								? t('torrents.settings.embedded')
								: 'qBittorrent'}
						</span>
					)}
				</div>
			)}

			{downloads.length === 0 ? (
				<EmptyState
					title={mediaRef ? t('torrents.list.emptyForTitle') : t('torrents.list.empty')}
					description={
						mediaRef ? t('torrents.list.emptyForTitleHint') : t('torrents.list.emptyHint')
					}
				/>
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
							onChooseFiles={() => requestFiles(item.id)}
						/>
					))}
				</ul>
			)}

			<TorrentFilesDrawer download={choosing} onClose={dismissFiles} />
		</section>
	)
}

interface DownloadRowProps {
	item: TorrentDownload
	showTitle: boolean
	onPause: () => void
	onResume: () => void
	onRemove: (withFiles: boolean) => void
	onChooseFiles: () => void
}

function DownloadRow({ item, showTitle, onPause, onResume, onRemove, onChooseFiles }: DownloadRowProps) {
	const { t } = useTranslation()

	const state = displayState(item)
	const live = item.live
	const downloading = item.state === 'downloading'
	const moving = downloading && live && !live.paused && !item.choosing

	return (
		<li className={clsx(styles.row, styles[state])}>
			<div className={styles.body}>
				<p className={styles.name} title={item.name || item.title}>
					{item.name || item.title}
				</p>

				{showTitle && (
					<Link
						to='/media/$mediaRef'
						params={{ mediaRef: item.media_ref }}
						className={styles.title}
					>
						{item.title}
					</Link>
				)}

				<div className={styles.stats}>
					<Badge tone={STATE_TONE[state]}>{t(`torrents.states.${state}`)}</Badge>

					{downloading && live && live.size > 0 && (
						<span className={styles.progress}>
							{Math.floor(live.progress * 100)}% · {formatBytes(live.size * live.progress)} /{' '}
							{formatBytes(live.size)}
						</span>
					)}

					{moving && (
						<>
							<span className={styles.stat} title={t('torrents.meta.down')}>
								<Icon name='common/download' size={13} />
								{t('torrents.meta.speed', { speed: formatBytes(live.dl_speed) })}
							</span>
							<span className={styles.stat}>
								{t('torrents.meta.seeds', { seeds: live.seeds, peers: live.peers })}
							</span>
							{live.eta ? (
								<span className={styles.stat}>
									<Icon name='common/clock' size={13} />
									{formatDuration(live.eta)}
								</span>
							) : null}
						</>
					)}

					{item.state === 'done' && (
						<span className={styles.stat}>
							{t('torrents.meta.imported', { count: item.imported })}
						</span>
					)}
				</div>

				{item.state === 'failed' && item.error && <p className={styles.error}>{item.error}</p>}

				{downloading && live && (
					<ProgressBar value={live.progress * 100} max={100} className={styles.bar} />
				)}
			</div>

			<div className={styles.actions}>
				{item.choosing && (
					<Button size='small' onClick={onChooseFiles}>
						{t('torrents.files.choose')}
					</Button>
				)}

				{downloading && live && !item.choosing && (
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
						...(downloading
							? [
									{
										id: 'files',
										label: t('torrents.files.choose'),
										icon: 'common/list-checks' as const,
										onSelect: onChooseFiles
									}
								]
							: []),
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
