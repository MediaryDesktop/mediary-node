import clsx from 'clsx'
import { useStoreMap, useUnit } from 'effector-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { useMediaCardSlots } from '../../lib/card-slots'
import { enumLabel } from '../../lib/format'
import { isReadMedia } from '../../lib/kinds'
import { mediaPreviewModel } from '../../model/model'

import { nextNumber, previewAction, previewFacts } from './lib/preview-text'
import styles from './MediaPreview.module.scss'
import { TrailerFrame } from './trailer-frame/TrailerFrame'

export interface MediaTracking {
	status: string
	statusLabel: string
	score: number
	genres: string[] | null
	year: number | null
	mediaType: string
	progress: number
	total: number | null
}

export interface MediaPreviewBase {
	cover_image: string | null
	media_type?: string
	format?: string | null
	status?: string | null
	season_year?: number | null
	average_score?: number | null
	episodes?: number | null
	chapters?: number | null
	genres?: string[] | null
}

export interface MediaPreviewProps {
	base: MediaPreviewBase
	mediaRef?: string
	title: string
	active: boolean
	tracking?: MediaTracking | null
	extra?: ReactNode
	actions?: ReactNode
	onOpen?: () => void
	onDownload?: () => void
}

export function MediaPreview({
	base,
	mediaRef,
	title,
	active,
	tracking,
	extra,
	actions,
	onOpen,
	onDownload
}: MediaPreviewProps) {
	const { t } = useTranslation()
	const slots = useMediaCardSlots()
	const [trailerHost, requestPreview] = useUnit([
		mediaPreviewModel.$trailerHost,
		mediaPreviewModel.previewRequested
	])

	const details = useStoreMap({
		store: mediaPreviewModel.$previews,
		keys: [mediaRef ?? ''],
		fn: (previews, [ref]) => (ref ? (previews[ref] ?? null) : null)
	})

	useEffect(() => {
		if (active && mediaRef) {
			requestPreview(mediaRef)
		}
	}, [active, mediaRef, requestPreview])

	const mediaType = details?.media_type ?? base.media_type ?? tracking?.mediaType ?? ''
	const reading = isReadMedia(mediaType)
	const format = details?.format ?? base.format ?? null
	const movie = format === 'MOVIE' || mediaType === 'movie'
	const year = details?.season_year ?? base.season_year ?? tracking?.year ?? null
	const rawScore = details?.mean_score ?? details?.average_score ?? base.average_score ?? null
	const statusLabel = enumLabel(t, 'status', details?.status ?? base.status)
	const genres = [
		...(details?.genres ?? base.genres ?? tracking?.genres ?? []),
		...(details?.studios ?? [])
	]

	const episodes = details?.episodes ?? base.episodes ?? null
	const chapters = details?.chapters ?? base.chapters ?? null
	const volumes = details?.volumes ?? null
	const duration = details?.duration ?? null
	const seasons = details?.seasons ?? 0

	const facts = previewFacts(t, {
		reading,
		movie,
		statusLabel,
		seasons,
		chapters,
		volumes,
		episodes,
		duration
	})

	const total = tracking?.total ?? (reading ? chapters : episodes)
	const primaryLabel = previewAction(t, {
		reading,
		movie,
		known: Boolean(chapters || tracking),
		next: nextNumber(tracking?.progress ?? 0, total)
	})

	const trailerId = details?.trailer?.site === 'youtube' ? details.trailer.id : null
	const thumbnail = details?.trailer?.thumbnail ?? null
	const backdrop = thumbnail ?? details?.banner_image ?? base.cover_image

	return (
		<div className={styles.preview}>
			<div className={styles.hero}>
				{backdrop && (
					<img
						className={clsx(
							styles.backdrop,
							thumbnail && styles.letterboxed,
							backdrop === base.cover_image && styles.cover
						)}
						src={backdrop}
						alt=''
						draggable={false}
					/>
				)}

				{active && trailerId && trailerHost && (
					<TrailerFrame key={trailerId} host={trailerHost} id={trailerId} title={title} />
				)}

				<span className={styles.heroFade} aria-hidden />
			</div>

			<div className={styles.body}>
				{onOpen ? (
					<button type='button' className={styles.title} onClick={onOpen}>
						{title}
					</button>
				) : (
					<p className={styles.title}>{title}</p>
				)}

				{(year != null || format || rawScore != null) && (
					<div className={styles.meta}>
						{year != null && <span>{year}</span>}
						{format && <span className={styles.chip}>{enumLabel(t, 'format', format)}</span>}
						{rawScore != null && (
							<span className={styles.score}>
								<Icon name='common/star' size={13} />
								{rawScore / 10}
							</span>
						)}
					</div>
				)}

				{facts.length > 0 && <p className={styles.facts}>{facts.join(' · ')}</p>}

				{genres.length > 0 && <p className={styles.genres}>{genres.join(', ')}</p>}

				{(tracking || statusLabel || extra) && (
					<div className={styles.progress}>
						{tracking && (
							<span className={styles.count}>
								{t('media.card.progress', {
									progress: tracking.progress,
									total: tracking.total ?? '?'
								})}
							</span>
						)}

						{tracking && <span className={styles.tracked}>{tracking.statusLabel}</span>}

						{tracking && tracking.score > 0 && (
							<span className={styles.personalScore}>
								<Icon name='common/star' size={12} />
								{tracking.score / 10}
							</span>
						)}

						{extra}
					</div>
				)}

				<div className={styles.actions}>
					{slots.play && mediaRef && !reading ? (
						slots.play({
							mediaRef,
							mediaType,
							title,
							label: movie ? t('media.card.watch') : primaryLabel,
							progress: tracking?.progress ?? 0,
							listed: Boolean(tracking),
							trailer: trailerId !== null,
							onOpen,
							onDownload
						})
					) : onOpen ? (
						<Button
							fullWidth
							variant='primary'
							size={reading ? 'small' : 'default'}
							className={styles.primary}
							startIcon={<Icon name={reading ? 'common/book-open' : 'common/play'} size={16} />}
							onClick={onOpen}
						>
							{primaryLabel}
						</Button>
					) : null}

					{((onDownload && !reading) || actions) && (
						<div className={styles.row}>
							{onDownload && !reading && (
								<Button
									size='small'
									variant='secondary'
									className={styles.download}
									startIcon={<Icon name='common/download' size={16} />}
									onClick={onDownload}
								>
									{t('media.card.download')}
								</Button>
							)}

							{actions}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
