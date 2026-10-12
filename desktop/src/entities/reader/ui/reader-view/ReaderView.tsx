import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, WindowControls } from '@shared/ui'

import type { ReaderChapter } from '../../api/api'
import { clampPage, isLastPage, prefetchIndexes } from '../../lib/pages'
import { pageUrl } from '../../lib/urls'
import { readerModel } from '../../model/model'

import styles from './ReaderView.module.scss'

export interface ReaderViewProps {
	chapter: ReaderChapter
	page: number
	onPageChange: (page: number) => void
	onClose: () => void
	previous: { ref: string } | null
	next: { ref: string } | null
	onOpenChapter: (ref: string) => void
}

export function ReaderView({
	chapter,
	page,
	onPageChange,
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
					onClose()
					break
				default:
					return
			}

			event.preventDefault()
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [current, total, goTo, onClose])

	const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect()
		const x = (event.clientX - rect.left) / rect.width

		if (x < 0.33) {
			goTo(current - 1)
		} else if (x > 0.66) {
			goTo(current + 1)
		} else {
			setControlsVisible(visible => !visible)
		}
	}

	const label = chapter.number ? t('reader.chapterNumber', { number: chapter.number }) : null

	return (
		<div className={styles.root}>
			<div
				className={clsx(styles.stage, total === 0 && styles.empty)}
				onClick={onStageClick}
				role='presentation'
			>
				{total > 0 ? (
					<img
						key={`${ref}-${current}`}
						className={styles.page}
						src={pageUrl(ref, current)}
						alt={t('reader.pageAlt', { number: current + 1 })}
						draggable={false}
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
					onClick={onClose}
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
				<input
					type='range'
					className={styles.seek}
					min={0}
					max={Math.max(total - 1, 0)}
					value={current}
					aria-label={t('reader.seek')}
					onChange={event => goTo(Number(event.target.value))}
				/>

				<div className={styles.bar}>
					<Button
						variant='ghost'
						size='small'
						disabled={!previous}
						onClick={() => previous && onOpenChapter(previous.ref)}
					>
						{t('reader.previousChapter')}
					</Button>

					<span className={styles.count}>
						{total > 0 ? t('reader.pageOf', { current: current + 1, total }) : ''}
						{total > 0 && isLastPage(current, total) && next === null && (
							<span className={styles.end}> · {t('reader.end')}</span>
						)}
					</span>

					<span className={styles.spacer} />

					<Button
						variant='ghost'
						size='small'
						disabled={!next}
						onClick={() => next && onOpenChapter(next.ref)}
					>
						{t('reader.nextChapter')}
					</Button>
				</div>
			</footer>
		</div>
	)
}
