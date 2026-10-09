import clsx from 'clsx'
import type { FoliateTocItem } from 'foliate-js/view.js'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, WindowControls } from '@shared/ui'

import type { ReaderBook } from '../../api/api'
import { isPdf } from '../../lib/book'

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

export interface BookReaderViewProps {
	book: ReaderBook
	file: File
	// Where to open the book; null starts it from its first page of text.
	locator: string | null
	onClose: () => void
	onRelocate: (location: BookLocation) => void
}

export function BookReaderView({ book, file, locator, onClose, onRelocate }: BookReaderViewProps) {
	const { t } = useTranslation()
	const viewRef = useRef<BookViewHandle>(null)

	const pdf = isPdf(book.content_type)

	const [appearance, setAppearance] = useState<BookAppearance>(loadAppearance)
	const [location, setLocation] = useState<BookLocation | null>(null)
	const [toc, setToc] = useState<FoliateTocItem[]>([])
	const [tocOpen, setTocOpen] = useState(false)
	const [ready, setReady] = useState(false)
	const [failed, setFailed] = useState(false)

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
						onClose()
					}
					break
				default:
					return
			}

			event.preventDefault()
		},
		[onClose, tocOpen]
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

	return (
		<div
			className={clsx(styles.root, appearance.theme !== 'dark' && styles.lightChrome)}
			style={{ background: pdf ? undefined : colors.background }}
		>
			<header className={styles.top}>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.close')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={onClose}
				/>

				<div className={styles.heading}>
					<span className={styles.title}>{book.title}</span>
					{location?.chapter && <span className={styles.subtitle}>{location.chapter}</span>}
				</div>

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
						<Button
							variant='ghost'
							size='small'
							aria-label={t('reader.book.smaller')}
							title={t('reader.book.smaller')}
							disabled={appearance.fontSize <= FONT_SIZES.min}
							onClick={() =>
								changeAppearance({
									...appearance,
									fontSize: clampFontSize(appearance.fontSize - FONT_SIZES.step)
								})
							}
						>
							A−
						</Button>
						<Button
							variant='ghost'
							size='small'
							aria-label={t('reader.book.larger')}
							title={t('reader.book.larger')}
							disabled={appearance.fontSize >= FONT_SIZES.max}
							onClick={() =>
								changeAppearance({
									...appearance,
									fontSize: clampFontSize(appearance.fontSize + FONT_SIZES.step)
								})
							}
						>
							A+
						</Button>
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

				{tocOpen && (
					<nav className={styles.contents} aria-label={t('reader.book.contents')}>
						<TocList
							items={toc}
							current={location?.chapter ?? null}
							onOpen={href => {
								viewRef.current?.goTo(href)
								setTocOpen(false)
							}}
						/>
					</nav>
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
					onChange={event => viewRef.current?.goToFraction(Number(event.target.value) / 1000)}
				/>
				<span className={styles.count}>
					{t('reader.book.percent', { percent })}
					{pages && <> · {pages}</>}
				</span>
			</footer>
		</div>
	)
}

interface TocListProps {
	items: FoliateTocItem[]
	current: string | null
	onOpen: (href: string) => void
}

function TocList({ items, current, onOpen }: TocListProps) {
	return (
		<ul className={styles.tocList}>
			{items.map(item => (
				<li key={`${item.href}-${item.label}`}>
					<button
						type='button'
						className={clsx(styles.tocItem, item.label.trim() === current && styles.active)}
						onClick={() => onOpen(item.href)}
					>
						{item.label.trim()}
					</button>
					{item.subitems && item.subitems.length > 0 && (
						<TocList items={item.subitems} current={current} onOpen={onOpen} />
					)}
				</li>
			))}
		</ul>
	)
}
