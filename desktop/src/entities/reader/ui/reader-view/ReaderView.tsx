import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { useAfterDelay } from '@shared/lib'
import { Button, Icon, Tooltip, WindowControls } from '@shared/ui'

import type { ReaderChapter } from '../../api/api'
import { clampPage, isLastPage, prefetchIndexes } from '../../lib/pages'
import { pageUrl } from '../../lib/urls'
import { readerModel } from '../../model/model'
import { useBookEntrance } from '../book-reader/lib/useBookEntrance'

import styles from './ReaderView.module.scss'

// Matches the book reader's and the video player's own slide, so every full-screen
// surface in the app opens and closes the same way.
const LEAVE_MS = 240

// How long a single click waits before it acts, in case a second one turns it into
// a double click instead; the one that zooms, not the one that turns the page.
const CLICK_DELAY_MS = 220

// Matches .zoomed's scale() in the stylesheet: a drag's on-screen distance is this
// many times the translate it needs, since the translate happens inside the same
// scale.
const ZOOM_SCALE = 2.2
// A drag shorter than this is a click that missed, not a pan — it still un-zooms.
const DRAG_THRESHOLD_PX = 4

export interface ReaderViewProps {
	chapter: ReaderChapter
	page: number
	onPageChange: (page: number) => void
	// When the page first asked to open this chapter — continues the loading panel's
	// own opening slide instead of starting a new one.
	openedAt: number
	onClose: () => void
	previous: { ref: string } | null
	next: { ref: string } | null
	onOpenChapter: (ref: string) => void
}

export function ReaderView({
	chapter,
	page,
	onPageChange,
	openedAt,
	onClose,
	previous,
	next,
	onOpenChapter
}: ReaderViewProps) {
	const { t } = useTranslation()
	const [pageTurned, counted] = useUnit([readerModel.pageTurned, readerModel.$counted])

	const total = chapter.pages?.length ?? 0
	const current = clampPage(page, total)
	const [controlsVisible, setControlsVisible] = useState(true)
	const [leaving, setLeaving] = useState(false)
	const [zoomed, setZoomed] = useState(false)
	const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })
	const [pan, setPan] = useState({ x: 0, y: 0 })
	const [dragging, setDragging] = useState(false)
	const clickTimer = useRef<number | undefined>(undefined)
	// A drag in progress: where it started, the pan it started from, and whether it
	// has moved enough to count as a pan rather than a click that un-zooms.
	const dragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(
		null
	)
	const draggedRef = useRef(false)
	const entrance = useBookEntrance(openedAt)

	const requestClose = useCallback(() => setLeaving(true), [])

	useAfterDelay(leaving, LEAVE_MS, onClose)

	const ref = chapter.ref

	const goTo = useCallback(
		(index: number) => {
			const target = clampPage(index, total)
			if (target !== current) {
				onPageChange(target)
			}
		},
		[current, total, onPageChange]
	)

	// The node counts the chapter when the last page is reached; every turn is
	// reported, and the node ignores the ones that do not matter.
	useEffect(() => {
		if (total > 0) {
			pageTurned({ ref, page: current })
		}
	}, [current, ref, total, pageTurned])

	// A zoomed-in page would otherwise carry its zoom to whatever comes next. Reset
	// during render (not an effect) per the React-recommended way to adjust state
	// when a prop changes, so the old page never flashes zoomed-out first.
	const [zoomedPage, setZoomedPage] = useState(current)
	if (zoomedPage !== current) {
		setZoomedPage(current)
		setZoomed(false)
		setPan({ x: 0, y: 0 })
	}

	useEffect(() => () => window.clearTimeout(clickTimer.current), [])

	// Fetch the pages ahead while the current one is on screen, so turning a page
	// does not wait on the archive.
	useEffect(() => {
		const preloaded = prefetchIndexes(current, total).map(index => {
			const image = new Image()
			image.src = pageUrl(ref, index)

			return image
		})

		return () => {
			for (const image of preloaded) {
				image.src = ''
			}
		}
	}, [current, total, ref])

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return
			}

			switch (event.key) {
				case 'ArrowRight':
				case 'PageDown':
				case ' ':
					goTo(current + 1)
					break
				case 'ArrowLeft':
				case 'PageUp':
					goTo(current - 1)
					break
				case 'Home':
					goTo(0)
					break
				case 'End':
					goTo(total - 1)
					break
				case 'Escape':
					requestClose()
					break
				default:
					return
			}

			event.preventDefault()
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [current, total, goTo, requestClose])

	// Held a moment in case a second click turns this into the double click that
	// zooms instead, so a tap-to-zoom does not also turn a page.
	const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
		// A drag that just ended fires its own click; that one pans, it does not
		// also un-zoom.
		if (draggedRef.current) {
			draggedRef.current = false
			return
		}

		if (zoomed) {
			setZoomed(false)
			setPan({ x: 0, y: 0 })
			return
		}

		const rect = event.currentTarget.getBoundingClientRect()
		const x = (event.clientX - rect.left) / rect.width

		window.clearTimeout(clickTimer.current)
		clickTimer.current = window.setTimeout(() => {
			if (x < 0.33) {
				goTo(current - 1)
			} else if (x > 0.66) {
				goTo(current + 1)
			} else {
				setControlsVisible(visible => !visible)
			}
		}, CLICK_DELAY_MS)
	}

	const onStageDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
		window.clearTimeout(clickTimer.current)

		const rect = event.currentTarget.getBoundingClientRect()
		setZoomOrigin({
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		})
		setPan({ x: 0, y: 0 })
		setZoomed(zoom => !zoom)
	}

	// A zoomed page is dragged to pan it: the translate is divided by the scale so
	// the image moves exactly as far as the pointer does, not 2.2x as far.
	const onPagePointerDown = (event: PointerEvent<HTMLImageElement>) => {
		if (!zoomed) {
			return
		}

		event.currentTarget.setPointerCapture(event.pointerId)
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			panX: pan.x,
			panY: pan.y
		}
	}

	const onPagePointerMove = (event: PointerEvent<HTMLImageElement>) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId) {
			return
		}

		const dx = event.clientX - drag.startX
		const dy = event.clientY - drag.startY

		if (!draggedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
			draggedRef.current = true
			setDragging(true)
		}

		if (draggedRef.current) {
			setPan({ x: drag.panX + dx / ZOOM_SCALE, y: drag.panY + dy / ZOOM_SCALE })
		}
	}

	const onPagePointerUp = (event: PointerEvent<HTMLImageElement>) => {
		if (dragRef.current?.pointerId === event.pointerId) {
			event.currentTarget.releasePointerCapture(event.pointerId)
			dragRef.current = null
			setDragging(false)
		}
	}

	const label = chapter.number ? t('reader.chapterNumber', { number: chapter.number }) : null
	const progress = total > 1 ? Math.round((current / (total - 1)) * 100) : 0

	return (
		<div
			className={clsx(styles.root, entrance.entering && styles.enter, leaving && styles.leave)}
			style={entrance.entering && !leaving ? entrance.style : undefined}
		>
			<div
				className={clsx(styles.stage, total === 0 && styles.empty, zoomed && styles.zoomed)}
				onClick={onStageClick}
				onDoubleClick={onStageDoubleClick}
				role='presentation'
			>
				{total > 0 ? (
					<img
						key={`${ref}-${current}`}
						className={clsx(styles.page, zoomed && styles.zoomed, dragging && styles.dragging)}
						src={pageUrl(ref, current)}
						alt={t('reader.pageAlt', { number: current + 1 })}
						draggable={false}
						onPointerDown={onPagePointerDown}
						onPointerMove={onPagePointerMove}
						onPointerUp={onPagePointerUp}
						onPointerCancel={onPagePointerUp}
						style={
							{
								'--zoom-x': `${zoomOrigin.x}%`,
								'--zoom-y': `${zoomOrigin.y}%`,
								'--pan-x': `${pan.x}px`,
								'--pan-y': `${pan.y}px`
							} as CSSProperties
						}
					/>
				) : (
					<p className={styles.message}>{t('reader.empty')}</p>
				)}
			</div>

			<header className={clsx(styles.top, controlsVisible && styles.visible)}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={requestClose}
				/>

				<div className={styles.heading}>
					<span className={styles.title}>{chapter.title}</span>
					{label && <span className={styles.subtitle}>{label}</span>}
					{chapter.source_name && (
						<span className={styles.subtitle}>
							{[chapter.source_name, ...(chapter.groups ?? [])].join(' · ')}
						</span>
					)}
				</div>

				{counted && (
					<span className={styles.counted}>
						<Icon name='common/check' size={14} />
						{t('reader.counted')}
					</span>
				)}

				<WindowControls className={styles.window} />
			</header>

			<footer className={clsx(styles.bottom, controlsVisible && styles.visible)}>
				<span className={styles.count}>
					{total > 0 ? t('reader.pageOf', { current: current + 1, total }) : ''}
					{total > 0 && isLastPage(current, total) && next === null && (
						<span className={styles.end}> · {t('reader.end')}</span>
					)}
				</span>

				<div className={styles.bar}>
					<Tooltip content={t('reader.previousChapter')}>
						<Button
							variant='ghost'
							size='small'
							iconOnly
							aria-label={t('reader.previousChapter')}
							startIcon={<Icon name='common/arrow-left' size={18} />}
							disabled={!previous}
							onClick={() => previous && onOpenChapter(previous.ref)}
						/>
					</Tooltip>

					<input
						type='range'
						className={styles.seek}
						min={0}
						max={Math.max(total - 1, 0)}
						value={current}
						disabled={total === 0}
						aria-label={t('reader.seek')}
						style={{ '--progress': `${progress}%` } as CSSProperties}
						onChange={event => goTo(Number(event.target.value))}
					/>

					<Tooltip content={t('reader.nextChapter')}>
						<Button
							variant='ghost'
							size='small'
							iconOnly
							aria-label={t('reader.nextChapter')}
							startIcon={<Icon name='common/arrow-right' size={18} />}
							disabled={!next}
							onClick={() => next && onOpenChapter(next.ref)}
						/>
					</Tooltip>
				</div>
			</footer>
		</div>
	)
}
