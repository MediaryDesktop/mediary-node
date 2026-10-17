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
	// The debrid service the cached mark is about, when the client is one.
	cacheService?: string
	// Playing without downloading, with a debrid service set up.
	watch?: ReleaseWatch
	// Absent for a release only ever watched: there is nothing to tick, each
	// result plays on its own rather than joining a batch to download.
	checked?: boolean
	onCheckedChange?: (on: boolean) => void
}

export interface ReleaseWatch {
	// False for a batch with no episode searched: there is nothing to pick by.
	possible: boolean
	// The service is readying this release; how far it is shows in the overlay.
	preparing: boolean
	onWatch: () => void
	onCancel: () => void
}

// One search result, ticked to download.
export function ReleaseCard({
	release,
	covered,
	poster,
	cacheService,
	watch,
	checked,
	onCheckedChange
}: ReleaseCardProps) {
	const { t, i18n } = useTranslation()
	const selectable = onCheckedChange !== undefined

	const Container = selectable ? 'label' : 'div'

	return (
		<Container
			className={clsx(
				styles.card,
				!selectable && styles.plain,
				checked && styles.checked,
				!release.eligible && styles.ineligible
			)}
		>
			{poster && <PosterFade src={poster} />}

			{selectable && (
				<Checkbox
					checked={checked ?? false}
					onCheckedChange={onCheckedChange}
					label={release.title}
					className={styles.check}
				/>
			)}

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
				{release.cached && cacheService && (
					<Badge tone='info' icon='common/download'>
						{t('torrents.search.cached', { service: cacheService })}
					</Badge>
				)}
				{covered.length > 0 && (
					<Badge tone='success'>{t('torrents.search.covers', { count: covered.length })}</Badge>
				)}
				{release.resolution && <Badge>{release.resolution}</Badge>}
				{release.codec && <Badge>{release.codec}</Badge>}
				{release.group && <Badge tone='accent'>{release.group}</Badge>}
			</div>

			{watch && (
				<button
					type='button'
					className={clsx(styles.page, watch.preparing && styles.busy)}
					disabled={!watch.possible && !watch.preparing}
					aria-label={watch.preparing ? t('torrents.stream.cancel') : t('torrents.stream.watch')}
					title={
						watch.preparing
							? t('torrents.stream.cancel')
							: watch.possible
								? t('torrents.stream.watch')
								: t('torrents.stream.pickEpisode')
					}
					onClick={event => {
						event.preventDefault()
						if (watch.preparing) {
							watch.onCancel()
						} else {
							watch.onWatch()
						}
					}}
				>
					<Icon name={watch.preparing ? 'common/close' : 'common/play'} size={16} />
				</button>
			)}

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
		</Container>
	)
}
