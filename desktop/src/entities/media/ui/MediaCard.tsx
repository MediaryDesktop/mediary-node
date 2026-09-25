import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { Icon } from '@shared/ui'

import type { MediaTitle } from '../api/api'
import { mediaTitle, scoreTone } from '../model/model'

import styles from './MediaCard.module.scss'
import { MediaPreview } from './MediaPreview'
import type { MediaTracking } from './MediaPreview'

function keyboardFocus(target: EventTarget | null) {
	if (!(target instanceof Element)) return false

	try {
		return target.matches(':focus-visible')
	} catch {
		return false
	}
}

const CARD_CLIP_PATH_D =
	'M 0.045,0 L 0.75,0 A 0.045,0.032 0,0,1 0.795,0.032 L 0.795,0.1 A 0.045,0.032 0,0,0 0.84,0.132 L 0.955,0.132 A 0.045,0.032 0,0,1 1,0.164 L 1,0.967 A 0.045,0.032 0,0,1 0.955,1 L 0.045,1 A 0.045,0.032 0,0,1 0,0.968 L 0,0.032 A 0.045,0.032 0,0,1 0.045,0 Z'

export interface MediaCardMedia {
	title: MediaTitle
	cover_image: string | null
	cover_color: string | null
}

export interface MediaCardProps {
	media: MediaCardMedia
	overlay?: ReactNode
	cornerLabel?: ReactNode
	scoreBadge?: number
	menu?: ReactNode
	children?: ReactNode
	previewRef?: string
	tracking?: MediaTracking | null
	onOpen?: () => void
	className?: string
}

export function MediaCard({
	media,
	overlay,
	cornerLabel,
	scoreBadge,
	menu,
	children,
	previewRef,
	tracking,
	onOpen,
	className
}: MediaCardProps) {
	const title = mediaTitle(media.title)
	const clipPathId = `media-card-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
	const [hovered, setHovered] = useState(false)
	const [focused, setFocused] = useState(false)
	const previewing = Boolean(previewRef) && (hovered || focused)
	const cardRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!hovered) return

		const drop = (event: PointerEvent) => {
			const node = cardRef.current
			if (!node) return

			const rect = node.getBoundingClientRect()
			const inside =
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom

			if (!inside) setHovered(false)
		}

		window.addEventListener('pointerup', drop)
		window.addEventListener('pointercancel', drop)

		return () => {
			window.removeEventListener('pointerup', drop)
			window.removeEventListener('pointercancel', drop)
		}
	}, [hovered])

	const content = (
		<>
			<svg width={0} height={0} className={styles.clipDefs} aria-hidden>
				<defs>
					<clipPath id={clipPathId} clipPathUnits='objectBoundingBox'>
						<path d={CARD_CLIP_PATH_D} />
					</clipPath>
				</defs>
			</svg>

			<span className={styles.cover} style={{ clipPath: `url(#${clipPathId})` }}>
				<span className={styles.poster} style={{ backgroundColor: media.cover_color ?? undefined }}>
					{media.cover_image && (
						<img src={media.cover_image} alt='' loading='lazy' draggable={false} />
					)}
				</span>

				{typeof scoreBadge === 'number' && (
					<span className={clsx(styles.scoreBadge, styles[scoreTone(scoreBadge)])}>
						<Icon name='common/star' size={12} />
						{scoreBadge / 10}
					</span>
				)}

				{cornerLabel && <span className={styles.cornerLabel}>{cornerLabel}</span>}
				{overlay && <span className={styles.overlay}>{overlay}</span>}
			</span>
		</>
	)

	return (
		<div
			ref={cardRef}
			className={clsx(styles.card, previewing && styles.previewing, className)}
			onPointerDown={event => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId)
				}
			}}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
			onFocus={event => setFocused(keyboardFocus(event.target))}
			onBlur={event => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					setFocused(false)
				}
			}}
		>
			{onOpen ? (
				<button
					type='button'
					className={styles.open}
					onClick={onOpen}
					title={title}
					aria-label={title}
				>
					{content}
				</button>
			) : (
				<div className={styles.open} title={title}>
					{content}
				</div>
			)}

			{previewRef && (
				<div className={styles.previewFrame} style={{ clipPath: `url(#${clipPathId})` }}>
					<MediaPreview
						mediaRef={previewRef}
						title={title}
						active={previewing}
						tracking={tracking}
					/>
				</div>
			)}

			{menu && (
				<div className={styles.menuFrame}>
					<div className={styles.menu}>{menu}</div>
				</div>
			)}

			{children}
		</div>
	)
}
