import clsx from 'clsx'
import type { FoliateTocItem } from 'foliate-js/view.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, Icon, ProgressBar, RippleButton, Tooltip, WindowControls } from '@shared/ui'

import type { ReaderBook } from '../../api/api'
import { isPdf } from '../../lib/book'
import { indexToc } from '../../lib/toc'

import {
	BOOK_THEMES,
	clampFontSize,
	FONT_SIZES,
	loadAppearance,
	saveAppearance,
	THEME_COLORS
} from './appearance'
import styles from './BookReaderView.module.scss'
import { FoliateView } from './FoliateView'
import { PdfView } from './PdfView'
import type { BookAppearance, BookLocation, BookViewHandle } from './types'
import { useBookEntrance } from './useBookEntrance'

// Matches the video player's own slide, so every full-screen surface in the
// app opens and closes the same way.
const LEAVE_MS = 240

export interface BookReaderViewProps {
	book: ReaderBook
	file: File
	// Where to open the book; null starts it from its first page of text.
	locator: string | null
	// When the page first asked to open this book — continues the loading panel's
	// own opening slide instead of starting a new one.
	openedAt: number
	onClose: () => void
	onRelocate: (location: BookLocation) => void
}

export function BookReaderView({ book, file, locator, openedAt, onClose, onRelocate }: BookReaderViewProps) {
	const { t } = useTranslation()
	const viewRef = useRef<BookViewHandle>(null)

	const pdf = isPdf(book.content_type)

	const [appearance, setAppearance] = useState<BookAppearance>(loadAppearance)
	const [location, setLocation] = useState<BookLocation | null>(null)
	const [toc, setToc] = useState<FoliateTocItem[]>([])
	const [tocOpen, setTocOpen] = useState(false)
	const [ready, setReady] = useState(false)
	const [failed, setFailed] = useState(false)
	const [leaving, setLeaving] = useState(false)
	const entrance = useBookEntrance(openedAt)

	const onCloseRef = useRef(onClose)
	useEffect(() => {
		onCloseRef.current = onClose
	})

	const requestClose = useCallback(() => setLeaving(true), [])

	useEffect(() => {
		if (!leaving) {
			return
		}

		const timer = window.setTimeout(() => onCloseRef.current(), LEAVE_MS)

		return () => window.clearTimeout(timer)
	}, [leaving])

	const tocIndex = useMemo(() => indexToc(toc, location?.chapter ?? null), [toc, location?.chapter])

	const changeAppearance = (next: BookAppearance) => {
		setAppearance(next)
		saveAppearance(next)
	}

	const relocate = useCallback(
		(next: BookLocation) => {
			setLocation(next)
			onRelocate(next)
		},
		[onRelocate]
	)

	const onKey = useCallback(
		(event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return
			}

			switch (event.key) {
				case 'ArrowRight':
				case 'PageDown':
				case ' ':
					viewRef.current?.next()
					break
				case 'ArrowLeft':
				case 'PageUp':
					viewRef.current?.prev()
					break
				case 'Escape':
					if (tocOpen) {
						setTocOpen(false)
					} else {
						requestClose()
					}
					break
				default:
					return
			}

			event.preventDefault()
		},
		[requestClose, tocOpen]
	)

	useEffect(() => {
		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [onKey])

	const fail = useCallback(() => setFailed(true), [])
	const colors = THEME_COLORS[appearance.theme]
	const nextTheme = BOOK_THEMES[(BOOK_THEMES.indexOf(appearance.theme) + 1) % BOOK_THEMES.length] ?? 'dark'

	const percent = location ? Math.round(location.fraction * 100) : 0
	const pages =
		location?.current && location.total
			? t('reader.pageOf', { current: location.current, total: location.total })
			: null

	const smallerFontSize = clampFontSize(appearance.fontSize - FONT_SIZES.step)
	const largerFontSize = clampFontSize(appearance.fontSize + FONT_SIZES.step)

	return (
		<div
			className={clsx(styles.root, entrance.entering && styles.enter, leaving && styles.leave)}
			style={
				{
					...(entrance.entering && !leaving ? entrance.style : undefined),
					'--chrome-bg': pdf ? '#000' : colors.background,
					'--chrome-text': pdf ? '#fff' : colors.text
				} as CSSProperties
			}
		>
			<header className={styles.top}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={requestClose}
				/>

				<div className={styles.heading}>
					<span className={styles.title}>{book.title}</span>
					{location?.chapter && <span className={styles.subtitle}>{location.chapter}</span>}
				</div>

				<WindowControls className={styles.window} />
			</header>

			<main className={styles.stage}>
				{failed ? (
					<p className={styles.message}>{t('reader.book.unreadable')}</p>
				) : pdf ? (
					<PdfView
						ref={viewRef}
						file={file}
						locator={locator}
						onReady={() => setReady(true)}
						onRelocate={relocate}
						onError={fail}
					/>
				) : (
					<FoliateView
						ref={viewRef}
						file={file}
						locator={locator}
						appearance={appearance}
						onReady={items => {
							setToc(items)
							setReady(true)
						}}
						onRelocate={relocate}
						onError={fail}
						onKey={onKey}
					/>
				)}

				{ready && !failed && (
					<>
						<button
							type='button'
							className={clsx(styles.turn, styles.previous)}
							aria-label={t('reader.book.previousPage')}
							onClick={() => viewRef.current?.prev()}
						>
							<Icon name='common/arrow-left' size={22} />
						</button>
						<button
							type='button'
							className={clsx(styles.turn, styles.next)}
							aria-label={t('reader.book.nextPage')}
							onClick={() => viewRef.current?.next()}
						>
							<Icon name='common/arrow-right' size={22} />
						</button>
					</>
				)}
			</main>

			<footer className={styles.bottom}>
				<input
					type='range'
					className={styles.seek}
					min={0}
					max={1000}
					value={Math.round((location?.fraction ?? 0) * 1000)}
					disabled={!ready || failed}
					aria-label={t('reader.book.position')}
					style={{ '--progress': `${percent}%` } as CSSProperties}
					onChange={event => viewRef.current?.goToFraction(Number(event.target.value) / 1000)}
				/>
				<span className={styles.count}>
					{t('reader.book.percent', { percent })}
					{pages && <> · {pages}</>}
				</span>

				{!pdf && (
					<div className={styles.tools}>
						<Button
							variant='ghost'
							size='small'
							aria-label={t('reader.book.contents')}
							title={t('reader.book.contents')}
							disabled={toc.length === 0}
							startIcon={<Icon name='common/list' size={18} />}
							onClick={() => setTocOpen(open => !open)}
						/>
						<Tooltip
							content={t('reader.book.percent', { percent: appearance.fontSize })}
							keepOpenOnClick
						>
							<Button
								variant='ghost'
								size='small'
								aria-label={t('reader.book.smaller')}
								disabled={appearance.fontSize <= FONT_SIZES.min}
								// Radix closes the tooltip on its own pointerdown/click; marking both
								// prevented keeps it open so the percent stays visible after clicking.
								onPointerDown={event => event.preventDefault()}
								onClick={event => {
									event.preventDefault()
									changeAppearance({ ...appearance, fontSize: smallerFontSize })
								}}
							>
								A−
							</Button>
						</Tooltip>
						<Tooltip
							content={t('reader.book.percent', { percent: appearance.fontSize })}
							keepOpenOnClick
						>
							<Button
								variant='ghost'
								size='small'
								aria-label={t('reader.book.larger')}
								disabled={appearance.fontSize >= FONT_SIZES.max}
								onPointerDown={event => event.preventDefault()}
								onClick={event => {
									event.preventDefault()
									changeAppearance({ ...appearance, fontSize: largerFontSize })
								}}
							>
								A+
							</Button>
						</Tooltip>
						<Button
							variant='ghost'
							size='small'
							aria-label={t(`reader.book.theme.${nextTheme}`)}
							title={t(`reader.book.theme.${nextTheme}`)}
							startIcon={
								<Icon name={nextTheme === 'dark' ? 'common/moon' : 'common/sun'} size={18} />
							}
							onClick={() => changeAppearance({ ...appearance, theme: nextTheme })}
						/>
					</div>
				)}
			</footer>

			<Drawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				title={t('reader.book.contents')}
				closable={false}
				side='right'
				size='sm'
			>
				<div className={styles.tocPanel}>
					{toc.length > 0 && <span className={styles.tocLabel}>{t('reader.book.chapters')}</span>}

					<div className={styles.tocScroll}>
						<TocList
							items={toc}
							numbers={tocIndex.numbers}
							current={location?.chapter ?? null}
							onOpen={href => {
								viewRef.current?.goTo(href)
								setTocOpen(false)
							}}
						/>
					</div>

					{tocIndex.total > 0 && (
						<div className={styles.tocFooter}>
							<span>
								{tocIndex.current != null
									? t('reader.book.contentsProgress', {
											current: tocIndex.current,
											count: tocIndex.total
										})
									: t('reader.book.contentsTotal', { count: tocIndex.total })}
							</span>
							<ProgressBar value={tocIndex.current ?? 0} max={tocIndex.total} />
						</div>
					)}
				</div>
			</Drawer>
		</div>
	)
}

interface TocListProps {
	items: FoliateTocItem[]
	numbers: WeakMap<FoliateTocItem, number>
	current: string | null
	onOpen: (href: string) => void
}

function TocList({ items, numbers, current, onOpen }: TocListProps) {
	return (
		<ul className={styles.tocList}>
			{items.map(item => {
				const active = item.label.trim() === current
				const number = numbers.get(item)

				return (
					<li key={`${item.href}-${item.label}`}>
						<RippleButton
							className={clsx(styles.tocItem, active && styles.active)}
							onClick={() => onOpen(item.href)}
						>
							{number != null && <span className={styles.tocNumber}>{number}.</span>}
							<span className={styles.tocLabelText}>{item.label.trim()}</span>
							<Icon name='common/chevron-down' size={14} className={styles.tocChevron} />
						</RippleButton>
						{item.subitems && item.subitems.length > 0 && (
							<TocList
								items={item.subitems}
								numbers={numbers}
								current={current}
								onOpen={onOpen}
							/>
						)}
					</li>
				)
			})}
		</ul>
	)
}
