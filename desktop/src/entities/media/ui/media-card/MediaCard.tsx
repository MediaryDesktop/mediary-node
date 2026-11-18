import clsx from 'clsx'
import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { HoverCard, Icon } from '@shared/ui'

import type { MediaTitle } from '../../api/api'
import { CardHoldContext } from '../../lib/card-hold'
import { enumLabel } from '../../lib/format'
import { mediaTitle } from '../../lib/titles'
import { mediaPreviewModel } from '../../model/model'
import { MediaPreview } from '../media-preview/MediaPreview'
import type { MediaPreviewBase, MediaTracking } from '../media-preview/MediaPreview'

import styles from './MediaCard.module.scss'

const PANEL_OVERHANG = 16

export interface MediaCardMedia extends MediaPreviewBase {
	title: MediaTitle
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
	previewExtra?: ReactNode
	onOpen?: () => void
	onDownload?: () => void
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
	previewExtra,
	onOpen,
	onDownload,
	className
}: MediaCardProps) {
	const { t } = useTranslation()
	const requestPreview = useUnit(mediaPreviewModel.previewRequested)
	const title = mediaTitle(media.title)
	const posterRef = useRef<HTMLSpanElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const pointerRef = useRef<{ x: number; y: number } | null>(null)
	const [hovered, setHovered] = useState(false)
	const [held, setHeld] = useState(false)
	const [offset, setOffset] = useState(0)

	const open = hovered || held

	const changeOpen = (next: boolean) => {
		if (next) {
			setOffset(posterRef.current?.parentElement?.offsetHeight ?? 0)
		}

		setHovered(next)
	}

	useEffect(() => {
		if (!open) {
			return undefined
		}

		const track = (event: PointerEvent) => {
			pointerRef.current = { x: event.clientX, y: event.clientY }
		}

		window.addEventListener('pointermove', track)

		return () => window.removeEventListener('pointermove', track)
	}, [open])

	const hold = useCallback((next: boolean) => {
		setHeld(next)

		if (!next) {
			const point = pointerRef.current
			const rect = panelRef.current?.getBoundingClientRect()

			setHovered(
				Boolean(
					point &&
					rect &&
					point.x >= rect.left &&
					point.x <= rect.right &&
					point.y >= rect.top &&
					point.y <= rect.bottom
				)
			)
		}
	}, [])

	const total = tracking?.total ?? null
	const progress = tracking ? Math.min(tracking.progress, total ?? tracking.progress) : null
	const year = media.season_year ?? tracking?.year ?? null
	const kind = enumLabel(t, 'format', media.format)
	const subtitle = [year, kind].filter(value => value != null && value !== '').join(', ')

	const poster = (
		<span ref={posterRef} className={styles.cover}>
			<span className={styles.poster} style={{ backgroundColor: media.cover_color ?? undefined }}>
				{media.cover_image && <img src={media.cover_image} alt='' loading='lazy' draggable={false} />}
			</span>

			{overlay && <span className={styles.overlay}>{overlay}</span>}

			{tracking && (
				<span
					className={clsx(styles.statusMark, tracking.status === 'COMPLETED' && styles.done)}
					title={tracking.statusLabel}
				>
					<Icon name={tracking.status === 'COMPLETED' ? 'common/check' : 'common/eye'} size={13} />
				</span>
			)}

			{(progress != null || typeof scoreBadge === 'number' || cornerLabel) && (
				<span className={styles.footer}>
					{progress != null ? (
						<span className={styles.count}>
							{progress}/{total ?? '?'}
						</span>
					) : (
						<span />
					)}

					{cornerLabel ? (
						<span className={styles.cornerLabel}>{cornerLabel}</span>
					) : (
						typeof scoreBadge === 'number' && (
							<span className={styles.scoreBadge}>
								<Icon name='common/star' size={11} />
								{scoreBadge / 10}
							</span>
						)
					)}
				</span>
			)}
		</span>
	)

	const caption = (
		<>
			<span className={styles.title}>{title}</span>
			{subtitle && <span className={styles.subtitle}>{subtitle}</span>}
		</>
	)

	const face = onOpen ? (
		<button type='button' className={styles.open} onClick={onOpen} aria-label={title}>
			{poster}
			{caption}
		</button>
	) : (
		<div className={styles.open}>
			{poster}
			{caption}
		</div>
	)

	return (
		<div
			className={clsx(styles.card, open && styles.active, className)}
			onPointerEnter={() => {
				if (previewRef) {
					requestPreview(previewRef)
				}
			}}
			onPointerDown={event => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId)
				}
			}}
		>
			{previewRef ? (
				<HoverCard
					trigger={face}
					side='bottom'
					align='center'
					sideOffset={-(offset + PANEL_OVERHANG)}
					openDelay={50}
					closeDelay={0}
					motion='grow'
					open={open}
					onOpenChange={changeOpen}
					contentRef={panelRef}
				>
					<CardHoldContext.Provider value={hold}>
						<MediaPreview
							base={media}
							mediaRef={previewRef}
							title={title}
							active={open}
							tracking={tracking}
							extra={previewExtra}
							actions={menu}
							onOpen={onOpen}
							onDownload={onDownload}
						/>
					</CardHoldContext.Provider>
				</HoverCard>
			) : (
				face
			)}

			{children}
		</div>
	)
}
