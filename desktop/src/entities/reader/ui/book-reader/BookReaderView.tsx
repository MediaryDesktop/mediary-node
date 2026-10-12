import clsx from 'clsx'
import type { FoliateTocItem } from 'foliate-js/view.js'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { useTranslation } from '@shared/i18n'
import { useAfterDelay } from '@shared/lib'
import { Button, Icon, WindowControls } from '@shared/ui'

import type { ReaderBook } from '../../api/api'
import { isPdf } from '../../lib/book'

import { AppearanceTools } from './book-footer/appearance-tools/AppearanceTools'
import { BookFooter } from './book-footer/BookFooter'
import styles from './BookReaderView.module.scss'
import { loadAppearance, saveAppearance, THEME_COLORS } from './lib/appearance'
import { useBookEntrance } from './lib/useBookEntrance'
import { useBookKeyboard } from './lib/useBookKeyboard'
import { TocDrawer } from './toc-drawer/TocDrawer'
import type { BookAppearance, BookLocation, BookViewHandle } from './types'
import { FoliateView } from './views/FoliateView'
import { PdfView } from './views/PdfView'

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

	const requestClose = useCallback(() => setLeaving(true), [])
	const closeToc = useCallback(() => setTocOpen(false), [])

	useAfterDelay(leaving, LEAVE_MS, onClose)

	const onKey = useBookKeyboard({ viewRef, tocOpen, onCloseToc: closeToc, onClose: requestClose })

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

	const fail = useCallback(() => setFailed(true), [])
	const colors = THEME_COLORS[appearance.theme]

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

			<BookFooter
				location={location}
				disabled={!ready || failed}
				onSeek={fraction => viewRef.current?.goToFraction(fraction)}
			>
				{!pdf && (
					<AppearanceTools
						appearance={appearance}
						onChange={changeAppearance}
						hasContents={toc.length > 0}
						onToggleContents={() => setTocOpen(open => !open)}
					/>
				)}
			</BookFooter>

			<TocDrawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				toc={toc}
				current={location?.chapter ?? null}
				onOpen={href => {
					viewRef.current?.goTo(href)
					setTocOpen(false)
				}}
			/>
		</div>
	)
}
