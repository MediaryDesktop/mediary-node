import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatRelativeTime } from '@shared/lib'
import { Badge, Icon, PosterFade } from '@shared/ui'

import type { TorrentRelease } from '@entities/torrent'

import { releaseLabel, resolutionTone, seedersLevel } from '../../../lib/releases'

import styles from './ReleaseRow.module.scss'

export interface ReleaseRowProps {
	release: TorrentRelease
	poster?: string | null
	cacheService?: string
	selected: boolean
	onSelect: () => void
	onStream: () => void
}

export function ReleaseRow({ release, poster, cacheService, selected, onSelect, onStream }: ReleaseRowProps) {
	const { t, i18n } = useTranslation()

	const fits = release.match === 'episode' || release.match === 'batch'
	const sourceName = release.indexer || release.source_name

	return (
		<li className={clsx(styles.row, selected && styles.selected, !release.eligible && styles.ineligible)}>
			{poster && <PosterFade src={poster} className={styles.art} />}

			<button
				type='button'
				className={styles.main}
				aria-pressed={selected}
				onClick={onSelect}
				onDoubleClick={onStream}
			>
				<span className={styles.release}>
					{release.group && <span className={styles.group}>{release.group}</span>}
					{release.resolution && (
						<span className={clsx(styles.resolution, styles[resolutionTone(release.resolution)])}>
							{release.resolution}
						</span>
					)}
				</span>

				<span className={styles.body}>
					<span className={styles.heading}>
						{release.batch && <Icon name='common/folder' size={16} className={styles.batch} />}
						<span className={styles.label}>{releaseLabel(release, t)}</span>
						{fits && (
							<Icon
								name='common/check-circle-2'
								size={14}
								className={clsx(styles.fits, release.best && styles.best)}
							/>
						)}
						{release.codec && <span className={styles.codec}>{release.codec}</span>}
					</span>

					<span className={styles.name} title={release.title}>
						{release.title}
					</span>

					<span className={styles.meta}>
						{release.best && (
							<Badge tone='accent' icon='common/sparkles'>
								{t('torrents.search.best')}
							</Badge>
						)}
						{release.cached && cacheService && (
							<Badge tone='info' icon='common/download'>
								{t('torrents.search.cached', { service: cacheService })}
							</Badge>
						)}
						<span className={clsx(styles.seeders, styles[seedersLevel(release.seeders)])}>
							<Icon name='common/signal' size={16} />
							<span className={styles.seedersCount}>{release.seeders}</span>
							<span className={styles.seedersWord}>
								{t('torrents.search.picker.seeders', { count: release.seeders })}
							</span>
						</span>
						{release.size > 0 && <span className={styles.size}>{formatBytes(release.size)}</span>}
						{release.published_at && (
							<span className={styles.date}>
								<Icon name='common/calendar' size={14} />
								{formatRelativeTime(release.published_at, i18n.language, { maxUnit: 'year' })}
							</span>
						)}
					</span>
				</span>
			</button>

			{release.page_url ? (
				<button
					type='button'
					className={styles.page}
					aria-label={t('torrents.search.page')}
					title={t('torrents.search.page')}
					onClick={() => window.open(release.page_url, '_blank', 'noreferrer')}
				>
					<span className={styles.pageName}>{sourceName}</span>
					<Icon name='common/external-link' size={14} />
				</button>
			) : (
				<span className={styles.page}>
					<span className={styles.pageName}>{sourceName}</span>
				</span>
			)}
		</li>
	)
}
