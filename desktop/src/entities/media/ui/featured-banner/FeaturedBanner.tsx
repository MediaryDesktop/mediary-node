import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Skeleton } from '@shared/ui'

import type { MediaSummary } from '../../api/api'
import { enumLabel, mediaTitle, scoreTone } from '../../model/model'

import styles from './FeaturedBanner.module.scss'
import { useBannerRotation } from './lib/useBannerRotation'
import { usePreloadImages } from './lib/usePreloadImages'

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
	items: T[]
	loading: boolean
	onOpen: (media: T) => void
	label: string
	openLabel: string
	extra?: (media: T) => ReactNode
	corner?: (media: T) => ReactNode
	bottom?: ReactNode
	className?: string
}

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

	const count = items.length
	const { index, transitioning, goTo, setPaused } = useBannerRotation(count)
	const current = count > 0 ? items[index % count] : undefined

	usePreloadImages(items.map(item => item.banner_image ?? item.cover_image))

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
