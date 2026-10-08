import clsx from 'clsx'
import useEmblaCarousel from 'embla-carousel-react'
import { Children, useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

import styles from './Carousel.module.scss'

export interface CarouselProps {
	children: ReactNode
	// Width of one item, as CSS; the row shows as many as fit.
	itemWidth?: string
	'aria-label'?: string
	className?: string
}

// A row of items that scrolls sideways: dragged, wheeled, or stepped a page at a
// time with the arrows, which appear only while there is somewhere to go.
export function Carousel({ children, itemWidth = '12.5rem', className, ...rest }: CarouselProps) {
	const { t } = useTranslation()
	const [viewport, api] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' })

	const [canPrevious, setCanPrevious] = useState(false)
	const [canNext, setCanNext] = useState(false)

	const update = useCallback(() => {
		if (!api) {
			return
		}

		setCanPrevious(api.canScrollPrev())
		setCanNext(api.canScrollNext())
	}, [api])

	useEffect(() => {
		if (!api) {
			return
		}

		// The first reading waits a frame: the track has to be laid out to measure.
		const frame = requestAnimationFrame(update)
		api.on('select', update).on('reInit', update).on('scroll', update)

		return () => {
			cancelAnimationFrame(frame)
			api.off('select', update).off('reInit', update).off('scroll', update)
		}
	}, [api, update])

	// A page at a time: as many items as are in view.
	const step = (direction: -1 | 1) => {
		if (!api) {
			return
		}

		const inView = Math.max(1, api.slidesInView().length)
		const target = api.selectedScrollSnap() + direction * inView

		api.scrollTo(Math.max(0, Math.min(target, api.scrollSnapList().length - 1)))
	}

	return (
		<div
			className={clsx(
				styles.root,
				canPrevious && styles.fadeStart,
				canNext && styles.fadeEnd,
				className
			)}
			style={{ '--carousel-item': itemWidth } as CSSProperties}
			role='region'
			aria-roledescription='carousel'
			aria-label={rest['aria-label']}
		>
			<div ref={viewport} className={styles.viewport}>
				<ul className={styles.track}>
					{Children.map(children, child => (
						<li className={styles.item}>{child}</li>
					))}
				</ul>
			</div>

			{canPrevious && (
				<Button
					variant='glass'
					iconOnly
					className={clsx(styles.arrow, styles.previous)}
					aria-label={t('carousel.previous')}
					onClick={() => step(-1)}
				>
					<Icon name='common/arrow-left' size={18} />
				</Button>
			)}

			{canNext && (
				<Button
					variant='glass'
					iconOnly
					className={clsx(styles.arrow, styles.next)}
					aria-label={t('carousel.next')}
					onClick={() => step(1)}
				>
					<Icon name='common/arrow-right' size={18} />
				</Button>
			)}
		</div>
	)
}
