import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatRelativeTime } from '@shared/lib'
import { Badge, Checkbox, Icon, PosterFade } from '@shared/ui'

import type { TorrentRelease } from '@entities/torrent'

import { releaseLabel } from '../../../lib/releases'

import styles from './ReleaseCard.module.scss'

export interface ReleaseCardProps {
	release: TorrentRelease
	// The missing episodes it would bring.
	covered: number[]
	poster?: string | null
	checked: boolean
	onCheckedChange: (on: boolean) => void
}

// One search result, ticked to download.
export function ReleaseCard({ release, covered, poster, checked, onCheckedChange }: ReleaseCardProps) {
	const { t, i18n } = useTranslation()

	return (
		<label
			className={clsx(styles.card, checked && styles.checked, !release.eligible && styles.ineligible)}
		>
			{poster && <PosterFade src={poster} />}

			<Checkbox
				checked={checked}
				onCheckedChange={onCheckedChange}
				label={release.title}
				className={styles.check}
			/>

			<div className={styles.body}>
				<span className={styles.episodeLabel}>{releaseLabel(release, t)}</span>
				<p className={styles.name} title={release.title}>
					{release.title}
				</p>
				<div className={styles.meta}>
					<span className={styles.seeds}>↑ {release.seeders}</span>
					<span>↓ {release.peers}</span>
					{release.size > 0 && <span>{formatBytes(release.size)}</span>}
					{release.published_at && (
						<span>
							{formatRelativeTime(release.published_at, i18n.language, { maxUnit: 'year' })}
						</span>
					)}
					<span>{release.indexer || release.source_name}</span>
				</div>
			</div>

			<div className={styles.badges}>
				{release.best && (
					<Badge tone='warning' icon='common/star'>
						{t('torrents.search.best')}
					</Badge>
				)}
				{covered.length > 0 && (
					<Badge tone='success'>{t('torrents.search.covers', { count: covered.length })}</Badge>
				)}
				{release.resolution && <Badge>{release.resolution}</Badge>}
				{release.codec && <Badge>{release.codec}</Badge>}
				{release.group && <Badge tone='accent'>{release.group}</Badge>}
			</div>

			{release.page_url && (
				<button
					type='button'
					className={styles.page}
					aria-label={t('torrents.search.page')}
					title={t('torrents.search.page')}
					onClick={event => {
						event.preventDefault()
						window.open(release.page_url, '_blank', 'noreferrer')
					}}
				>
					<Icon name='common/external-link' size={16} />
				</button>
			)}
		</label>
	)
}
