import clsx from 'clsx'
import { useStoreMap, useUnit } from 'effector-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { useMediaCardSlots } from '../../lib/card-slots'
import { enumLabel, mediaPreviewModel } from '../../model/model'

import styles from './MediaPreview.module.scss'

const TRAILER_DELAY = 300
const REVEAL_FALLBACK_MS = 6000
const READING_TYPES = ['manga', 'book']

interface TrailerFrameProps {
	host: string
	id: string
	title: string
}

interface TrailerMessage {
	source?: unknown
	state?: unknown
}

function TrailerFrame({ host, id, title }: TrailerFrameProps) {
	const { t } = useTranslation()
	const frameRef = useRef<HTMLIFrameElement>(null)
	const [mounted, setMounted] = useState(false)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const timer = window.setTimeout(() => setMounted(true), TRAILER_DELAY)

		return () => window.clearTimeout(timer)
	}, [])

	useEffect(() => {
		if (!mounted) {
			return
		}

		let confirmed = false

		const onMessage = (event: MessageEvent<TrailerMessage | null>) => {
			if (event.origin !== host || event.source !== frameRef.current?.contentWindow) {
				return
			}

			if (event.data?.source === 'mediary-trailer') {
				confirmed = true
				setVisible(event.data.state === 'playing')
			}
		}

		window.addEventListener('message', onMessage)

		const fallback = window.setTimeout(() => {
			if (!confirmed) {
				setVisible(true)
			}
		}, REVEAL_FALLBACK_MS)

		return () => {
			window.removeEventListener('message', onMessage)
			window.clearTimeout(fallback)
		}
	}, [host, mounted])

	if (!mounted) {
		return null
	}

	return (
		<div className={clsx(styles.trailer, visible && styles.visible)}>
			<iframe
				ref={frameRef}
				src={`${host}/trailer?v=${encodeURIComponent(id)}`}
				title={t('media.trailerFor', { title })}
				allow='autoplay; encrypted-media'
				tabIndex={-1}
			/>
		</div>
	)
}

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
	const reading = READING_TYPES.includes(mediaType)
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

	const facts = [
		enumLabel(t, 'format', format),
		seasons > 1 ? t('media.card.seasons', { count: seasons }) : null,
		reading
			? chapters
				? t('media.card.chapters', { count: chapters })
				: volumes
					? t('media.card.volumes', { count: volumes })
					: null
			: episodes && !movie
				? t('media.card.episodes', { count: episodes })
				: null,
		!reading && duration ? t('media.card.minutesEach', { count: duration }) : null
	].filter(Boolean)

	const total = tracking?.total ?? (reading ? chapters : episodes)
	const next = Math.max(
		1,
		total ? Math.min((tracking?.progress ?? 0) + 1, total) : (tracking?.progress ?? 0) + 1
	)
	const primaryLabel = reading
		? chapters || tracking
			? t('media.card.read', { chapter: next })
			: t('media.card.open')
		: movie
			? t('media.card.open')
			: t('media.card.play', { episode: next })

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

				{facts.length > 0 && <p className={styles.facts}>{facts.join(', ')}</p>}

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

						{statusLabel && <span className={styles.status}>{statusLabel}</span>}

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
							className={styles.primary}
							startIcon={<Icon name={reading ? 'common/book-open' : 'common/play'} size={16} />}
							onClick={onOpen}
						>
							{primaryLabel}
						</Button>
					) : null}

					{onDownload && !reading && (
						<Button
							size='small'
							variant='control'
							className={styles.download}
							startIcon={<Icon name='common/download' size={16} />}
							onClick={onDownload}
						>
							{t('media.card.download')}
						</Button>
					)}

					{actions && <div className={styles.row}>{actions}</div>}
				</div>
			</div>
		</div>
	)
}
