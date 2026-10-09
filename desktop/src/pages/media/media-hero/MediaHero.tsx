import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { formatCompact } from '@shared/lib'
import { Icon, Tooltip } from '@shared/ui'

import { alternativeTitles, enumLabel, formatMediaDate, mediaTitle, scoreTone } from '@entities/media'
import type { MediaDetails, MediaSource } from '@entities/media'
import { isTrackerMediaType } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import type { MediaBase } from '../lib/media-view'

import styles from './MediaHero.module.scss'

export interface MediaHeroProps {
	base: MediaBase
	media: MediaDetails | null
	entry: TrackerEntry | null
	sources: MediaSource[]
	mediaType: string
	total: number | null | undefined
	locale: string
	onOpenDescription: () => void
}

export function MediaHero({
	base,
	media,
	entry,
	sources,
	mediaType,
	total,
	locale,
	onOpenDescription
}: MediaHeroProps) {
	const { t } = useTranslation()

	const title = mediaTitle(base.title)
	const alternatives = alternativeTitles(base.title)
	const description = media?.description ?? ''
	const cover = base.cover_image
	const backdrop = base.banner_image ?? cover
	const airingStatus = base.status
	const startDate = media ? formatMediaDate(media.start_date, locale) : null
	const season = media?.season ? enumLabel(t, 'season', media.season) : null

	return (
		<header className={styles.hero}>
			<div className={styles.backdrop} style={{ backgroundColor: base.cover_color ?? undefined }}>
				{backdrop && (
					<img
						src={backdrop}
						alt=''
						className={base.banner_image ? undefined : styles.blurred}
						draggable={false}
					/>
				)}

				<span className={styles.fadeTop} />
				<span className={styles.fadeLeft} />
				<span className={styles.fadeLeftSoft} />
				<span className={styles.fadeBottom} />
			</div>

			<div className={styles.details}>
				<div className={styles.entry}>
					<div className={styles.cover} style={{ backgroundColor: base.cover_color ?? undefined }}>
						{cover && <img src={cover} alt='' draggable={false} />}
					</div>

					<div className={styles.info}>
						<h1 className={styles.title}>{title}</h1>

						{alternatives.map(name => (
							<p key={name} className={styles.alternative}>
								{name}
							</p>
						))}

						<div className={styles.metaRow}>
							{entry && entry.score > 0 && (
								<span className={clsx(styles.userScore, styles[scoreTone(entry.score)])}>
									<Icon name='common/star' size={16} />
									{entry.score / 10}
								</span>
							)}

							<span className={styles.progress}>
								{entry?.progress ?? 0}
								<span className={styles.progressTotal}>/{total ?? '-'}</span>
							</span>

							{entry && (
								<span className={styles.listStatus}>
									{isTrackerMediaType(mediaType)
										? t(`lists.status.${mediaType}.${entry.status}` as never, {
												defaultValue: entry.status
											})
										: entry.status}
								</span>
							)}

							<span className={styles.divider} />

							{startDate && (
								<span className={styles.date}>
									<Icon name='common/calendar' size={17} />
									{season ? `${startDate} - ${season}` : startDate}
								</span>
							)}

							{airingStatus && airingStatus !== 'FINISHED' && (
								<span className={styles.airing}>
									<Icon name='common/signal' size={16} />
									{enumLabel(t, 'status', airingStatus)}
								</span>
							)}
						</div>

						<div className={styles.tagRow}>
							{media?.mean_score != null && (
								<span
									className={clsx(
										styles.audienceScore,
										styles[scoreTone(media.mean_score)]
									)}
									title={t('media.stats.averageScore')}
								>
									<Icon name='common/heart' size={14} />
									{media.mean_score / 10}
								</span>
							)}

							{mediaType === 'book'
								? media?.authors?.[0] && (
										<span className={styles.studio}>{media.authors.join(', ')}</span>
									)
								: media?.studios?.[0] && (
										<span className={styles.studio}>{media.studios[0]}</span>
									)}

							{media?.genres?.map(genre => (
								<span key={genre} className={styles.genre}>
									{genre}
								</span>
							))}

							{media?.popularity != null && (
								<span className={styles.stat} title={t('media.stats.popularity')}>
									<Icon name='common/users' size={14} />
									{formatCompact(media.popularity, locale)}
								</span>
							)}
						</div>

						{media && (
							<button type='button' className={styles.description} onClick={onOpenDescription}>
								{description || t('media.noDescription')}
							</button>
						)}

						<div className={styles.links}>
							<a
								className={styles.iconLink}
								href={base.site_url}
								target='_blank'
								rel='noreferrer'
								aria-label={t('media.openOn', { name: sources[0]?.name ?? 'AniList' })}
							>
								<Icon
									name={
										sources[0]?.id === 'anilist'
											? 'social/anilist'
											: 'common/external-link'
									}
									size={18}
								/>
							</a>

							<Tooltip content={t('media.comingSoon')}>
								<span className={styles.iconActionWrap}>
									<button type='button' disabled className={styles.textLink}>
										{t('media.trailer')}
									</button>
								</span>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		</header>
	)
}
