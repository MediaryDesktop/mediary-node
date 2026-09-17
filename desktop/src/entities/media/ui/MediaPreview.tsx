import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { enumLabel, mediaPreviewModel, scoreTone } from '../model/model'

import styles from './MediaPreview.module.scss'

const TRAILER_DELAY = 300
const REVEAL_FALLBACK_MS = 6000

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

export interface MediaPreviewProps {
	mediaRef: string
	title: string
	active: boolean
}

export function MediaPreview({ mediaRef, title, active }: MediaPreviewProps) {
	const { t } = useTranslation()
	const [previews, trailerHost, requestPreview] = useUnit([
		mediaPreviewModel.$previews,
		mediaPreviewModel.$trailerHost,
		mediaPreviewModel.previewRequested
	])

	const details = previews[mediaRef] ?? null
	const trailerId = details?.trailer?.site === 'youtube' ? details.trailer.id : null

	useEffect(() => {
		if (active) {
			requestPreview(mediaRef)
		}
	}, [active, mediaRef, requestPreview])

	const score = details?.mean_score ?? details?.average_score ?? null
	const season = details?.season ? enumLabel(t, 'season', details.season) : null
	const when = [season, details?.season_year].filter(Boolean).join(' ')

	const thumbnail = details?.trailer?.thumbnail ?? null
	const backdrop = thumbnail ?? details?.banner_image ?? null

	return (
		<div className={styles.preview} data-theme='dark'>
			{active && backdrop && (
				<img
					className={clsx(styles.backdrop, thumbnail && styles.letterboxed)}
					src={backdrop}
					alt=''
					draggable={false}
				/>
			)}

			{active && trailerId && trailerHost && (
				<TrailerFrame key={trailerId} host={trailerHost} id={trailerId} title={title} />
			)}

			<div className={styles.info}>
				<p className={styles.title}>{title}</p>

				{(score != null || when) && (
					<div className={styles.meta}>
						{score != null && (
							<span className={clsx(styles.score, styles[scoreTone(score)])}>
								<Icon name='common/star' size={13} />
								{score / 10}
							</span>
						)}

						{when && (
							<span className={styles.when}>
								<Icon name='common/calendar' size={13} />
								{when}
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
