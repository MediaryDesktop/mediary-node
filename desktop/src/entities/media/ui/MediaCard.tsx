import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon, ProgressBar } from '@shared/ui'

import type { MediaTitle } from '../api/api'
import { mediaTitle, scoreTone } from '../model/model'

import styles from './MediaCard.module.scss'

export interface MediaCardMedia {
	title: MediaTitle
	cover_image: string | null
	cover_color: string | null
}

export interface MediaCardProgress {
	value: number
	max: number | null
}

export interface MediaCardProps {
	media: MediaCardMedia
	caption?: ReactNode
	overlay?: ReactNode
	cornerLabel?: ReactNode
	scoreBadge?: number
	progress?: MediaCardProgress
	children?: ReactNode
	onOpen?: () => void
	className?: string
}

export function MediaCard({
	media,
	caption,
	overlay,
	cornerLabel,
	scoreBadge,
	progress,
	children,
	onOpen,
	className
}: MediaCardProps) {
	const title = mediaTitle(media.title)

	const cover = (
		<>
			<span className={styles.cover} style={{ backgroundColor: media.cover_color ?? undefined }}>
				{media.cover_image && <img src={media.cover_image} alt='' loading='lazy' draggable={false} />}

				{typeof scoreBadge === 'number' && (
					<span className={clsx(styles.scoreBadge, styles[scoreTone(scoreBadge)])}>
						<Icon name='common/star' size={12} />
						{scoreBadge / 10}
					</span>
				)}

				{cornerLabel && <span className={styles.cornerLabel}>{cornerLabel}</span>}
				{overlay && <span className={styles.overlay}>{overlay}</span>}

				{progress && (
					<span className={styles.progress}>
						<ProgressBar value={progress.value} max={progress.max} label={title} />
					</span>
				)}
			</span>

			<span className={styles.title}>{title}</span>
			{caption && <span className={styles.caption}>{caption}</span>}
		</>
	)

	return (
		<div className={clsx(styles.card, className)}>
			{onOpen ? (
				<button type='button' className={styles.open} onClick={onOpen} title={title}>
					{cover}
				</button>
			) : (
				<div className={styles.open}>{cover}</div>
			)}

			{children}
		</div>
	)
}
