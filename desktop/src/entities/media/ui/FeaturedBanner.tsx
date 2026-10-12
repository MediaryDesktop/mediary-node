import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Skeleton } from '@shared/ui'

import type { MediaSummary } from '../api/api'
import { enumLabel, mediaTitle, scoreTone } from '../model/model'

import styles from './FeaturedBanner.module.scss'

// Long enough to read the synopsis, short enough that the banner feels alive.
const ROTATE_EVERY = 12000
// How long the banner stays veiled while the next title swaps in behind it.
const TRANSITION_HOLD = 900

// What the banner needs of a title: a search result has all of it, a list entry
// everything but the synopsis and the dates.
export type FeaturedMedia = Pick<
	MediaSummary,
	| 'media_ref'
	| 'title'
	| 'banner_image'
	| 'cover_image'
	| 'cover_color'
	| 'season_year'
	| 'format'
	| 'average_score'
	| 'genres'
> &
	Partial<Pick<MediaSummary, 'start_date' | 'media_type' | 'authors' | 'description'>>

export interface FeaturedBannerProps<T extends FeaturedMedia> {
	// The titles the banner goes through, in order. Empty while they load.
	items: T[]
	loading: boolean
	onOpen: (media: T) => void
	// Names the row of dots for a screen reader.
	label: string
	openLabel: string
	// Whatever the page adds under the synopsis of the title on show.
	extra?: (media: T) => ReactNode
	// Floats over the bottom-right corner of the banner, clear of the title block.
	corner?: (media: T) => ReactNode
	// Floats at the bottom edge, centered over the fade: Discover's tab switcher.
	bottom?: ReactNode
	className?: string
}

// A page-wide banner: one title at a time, moving on by itself until the pointer
// rests on it, or jumped to with the dots. The dots sit above the poster, the
// title and its details below — both pinned to the top of the banner.
export function FeaturedBanner<T extends FeaturedMedia>({
	items,
	loading,
	onOpen,
	label,
	openLabel,
	extra,
	corner,
	bottom,
	className
}: FeaturedBannerProps<T>) {
	const { t } = useTranslation()
	const reduced = useReducedMotion()

	const [index, setIndex] = useState(0)
	const [paused, setPaused] = useState(false)
	// True for the TRANSITION_HOLD stretch between asking for the next title and
	// it actually taking over: the backdrop darkens and holds still, hiding the
	// swap underneath, then lifts again once it has already happened.
	const [transitioning, setTransitioning] = useState(false)
	const swapTimer = useRef<number | undefined>(undefined)

	const count = items.length
	const current = count > 0 ? items[index % count] : undefined

	// Jumps straight to a title the TRANSITION_HOLD stretch later, veiled the
	// whole way; a jump already in flight is replaced rather than queued.
	const goTo = useCallback((next: number | ((value: number) => number)) => {
		window.clearTimeout(swapTimer.current)
		setTransitioning(true)

		swapTimer.current = window.setTimeout(() => {
			setIndex(next)
			setTransitioning(false)
		}, TRANSITION_HOLD)
	}, [])

	useEffect(() => () => window.clearTimeout(swapTimer.current), [])

	useEffect(() => {
		if (paused || count < 2) {
			return
		}

		const timer = window.setInterval(() => goTo(value => (value + 1) % count), ROTATE_EVERY)

		return () => window.clearInterval(timer)
	}, [paused, count, goTo])

	// Warms the browser's cache for every title the banner will show, so a swap
	// reveals a picture that is already there instead of one still loading in.
	useEffect(() => {
		const preloaded = items.map(item => {
			const src = item.banner_image ?? item.cover_image
			const image = new Image()
			if (src) {
				image.src = src
			}

			return image
		})

		return () => {
			for (const image of preloaded) {
				image.src = ''
			}
		}
	}, [items])

	const backdrop = current && (current.banner_image ?? current.cover_image)
	const year = current && (current.season_year ?? current.start_date?.year)
	const format = current && enumLabel(t, 'format', current.format)
	const byline = current?.media_type === 'book' ? current.authors?.join(', ') : null

	const rise = reduced ? { opacity: 0 } : { opacity: 0, x: -16 }
	const settle = reduced ? { opacity: 0 } : { opacity: 0, x: 10 }

	return (
		<header
			className={clsx(styles.hero, className)}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			<div className={styles.backdrop} style={{ backgroundColor: current?.cover_color ?? undefined }}>
				{backdrop && (
					<img
						src={backdrop}
						alt=''
						className={clsx(
							styles.image,
							!current.banner_image && styles.blurred,
							transitioning && !reduced && styles.transitioning
						)}
						draggable={false}
					/>
				)}
				<span className={clsx(styles.scrim, transitioning && styles.visible)} />
				<span className={styles.fadeLeft} />
				<span className={styles.fadeBottom} />
			</div>

			<AnimatePresence mode='wait'>
				{current ? (
					<motion.div
						key={current.media_ref}
						className={styles.content}
						initial={rise}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0 }}
						transition={
							reduced ? { duration: 0.3 } : { type: 'spring', damping: 20, stiffness: 100 }
						}
					>
						{count > 1 && (
							<div className={styles.dots} role='tablist' aria-label={label}>
								{items.map((item, position) => (
									<button
										key={item.media_ref}
										type='button'
										role='tab'
										aria-selected={position === index % count}
										aria-label={mediaTitle(item.title)}
										className={clsx(
											styles.dot,
											position === index % count && styles.active
										)}
										onClick={() => position !== index % count && goTo(position)}
									/>
								))}
							</div>
						)}

						<div className={styles.entry}>
							{current.cover_image && (
								<motion.button
									type='button'
									className={styles.cover}
									onClick={() => onOpen(current)}
									initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ duration: 0.5 }}
								>
									<img src={current.cover_image} alt='' draggable={false} />
								</motion.button>
							)}

							<div className={styles.info}>
								<motion.div
									className={styles.heading}
									initial={settle}
									animate={{ opacity: 1, x: 0 }}
									transition={{ duration: 0.5, delay: 0.15 }}
								>
									<h1 className={styles.title}>{mediaTitle(current.title)}</h1>

									<div className={styles.meta}>
										{current.average_score != null && (
											<span
												className={clsx(
													styles.score,
													styles[scoreTone(current.average_score)]
												)}
											>
												<Icon name='common/heart' size={14} />
												{current.average_score / 10}
											</span>
										)}
										{byline && <span className={styles.byline}>{byline}</span>}
										{year && <span>{year}</span>}
										{format && <span>{format}</span>}
										{(current.genres ?? []).slice(0, 3).map(genre => (
											<span key={genre} className={styles.genre}>
												{genre}
											</span>
										))}
									</div>
								</motion.div>

								<motion.div
									className={styles.detailsGroup}
									initial={settle}
									animate={{ opacity: 1, x: 0 }}
									transition={{ duration: 0.5, delay: 0.25 }}
								>
									{current.description && (
										<p className={styles.description}>{current.description}</p>
									)}

									{extra?.(current)}

									<button
										type='button'
										className={styles.detailsLink}
										onClick={() => onOpen(current)}
									>
										<Icon name='common/info' size={15} />
										{openLabel}
									</button>
								</motion.div>
							</div>
						</div>
					</motion.div>
				) : (
					loading && (
						<div className={clsx(styles.content, styles.loadingContent)}>
							<Skeleton width='14rem' height='2.5rem' radius='10px' />
							<Skeleton width='22rem' height='1rem' radius='6px' />
							<Skeleton width='18rem' height='1rem' radius='6px' />
						</div>
					)
				)}
			</AnimatePresence>

			<AnimatePresence mode='wait'>
				{current && corner && (
					<motion.div
						key={current.media_ref}
						className={styles.cornerSlot}
						initial={settle}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						{corner(current)}
					</motion.div>
				)}
			</AnimatePresence>

			{bottom && <div className={styles.tabsSlot}>{bottom}</div>}
		</header>
	)
}
