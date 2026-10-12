import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { IoLibraryOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatDuration } from '@shared/lib'
import { Badge, Button, Icon, MoreMenu, PosterFade, ProgressBar } from '@shared/ui'
import type { BadgeTone } from '@shared/ui'

import type { TorrentDownload } from '@entities/torrent'

import { displayState } from '../../../lib/display-state'
import type { TorrentDisplayState } from '../../../lib/display-state'

import styles from './DownloadRow.module.scss'

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
	done: 'accent',
	failed: 'danger',
	unknown: 'neutral'
}

// One torrent: what it is, how far it got, and what can be done to it.
export interface DownloadRowProps {
	item: TorrentDownload
	showTitle: boolean
	poster?: string | null
	onPause: () => void
	onResume: () => void
	onRemove: (withFiles: boolean) => void
	onChooseFiles: () => void
}

export function DownloadRow({
	item,
	showTitle,
	poster,
	onPause,
	onResume,
	onRemove,
	onChooseFiles
}: DownloadRowProps) {
	const { t } = useTranslation()

	const state = displayState(item)
	const live = item.live
	const downloading = item.state === 'downloading'
	const moving = downloading && live && !live.paused && !item.choosing

	return (
		<li className={clsx(styles.row, styles[state])}>
			{poster && <PosterFade src={poster} className={styles.poster} />}

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
					<Badge
						tone={STATE_TONE[state]}
						icon={state === 'done' ? <IoLibraryOutline size={14} /> : undefined}
					>
						{t(`torrents.states.${state}`)}
					</Badge>

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

				<MoreMenu
					label={t('torrents.menu')}
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
				/>
			</div>
		</li>
	)
}
