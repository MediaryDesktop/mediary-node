import clsx from 'clsx'
import useEmblaCarousel from 'embla-carousel-react'
import { Children, useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { Icon, renderIcon } from '../icon/Icon'
import type { IconLike } from '../icon/Icon'

import styles from './Carousel.module.scss'

const MAX_DOTS = 30

export interface CarouselProps {
	children: ReactNode
	title?: ReactNode
	icon?: IconLike
	more?: { label: string; onClick: () => void }
	itemWidth?: string
	'aria-label'?: string
	className?: string
}

export function Carousel({
	children,
	title,
	icon,
	more,
	itemWidth = '12.5rem',
	className,
	...rest
}: CarouselProps) {
	const [viewport, api] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' })

	const [snaps, setSnaps] = useState<number[]>([])
	const [selected, setSelected] = useState(0)

	const update = useCallback(() => {
		if (!api) {
			return
		}

		setSnaps(api.scrollSnapList())
		setSelected(api.selectedScrollSnap())
	}, [api])

	useEffect(() => {
		if (!api) {
			return
		}

		const frame = requestAnimationFrame(update)
		api.on('select', update).on('reInit', update)

		return () => {
			cancelAnimationFrame(frame)
			api.off('select', update).off('reInit', update)
		}
	}, [api, update])

	const ariaLabel = rest['aria-label'] ?? (typeof title === 'string' ? title : undefined)
	const showDots = snaps.length > 1 && snaps.length <= MAX_DOTS

	const Root = title != null ? 'section' : 'div'

	return (
		<Root
			className={clsx(styles.root, className)}
			style={{ '--carousel-item': itemWidth } as CSSProperties}
		>
			{(title != null || showDots) && (
				<div className={styles.header}>
					{title != null && (
						<h2 className={styles.title}>
							{icon && <span className={styles.titleIcon}>{renderIcon(icon, 24)}</span>}
							{title}
							{more && (
								<button
									type='button'
									className={styles.more}
									aria-label={more.label}
									onClick={more.onClick}
								>
									<Icon name='common/chevron-down' size={22} className={styles.chevron} />
								</button>
							)}
						</h2>
					)}

					{showDots && (
						<div className={styles.dots} role='group' aria-label={ariaLabel}>
							{snaps.map((_, index) => (
								<button
									key={index}
									type='button'
									aria-label={String(index + 1)}
									aria-current={index === selected || undefined}
									className={clsx(styles.dot, index === selected && styles.isActive)}
									onClick={() => api?.scrollTo(index)}
								/>
							))}
						</div>
					)}
				</div>
			)}

			<div
				ref={viewport}
				className={styles.viewport}
				role='region'
				aria-roledescription='carousel'
				aria-label={ariaLabel}
			>
				<ul className={styles.track}>
					{Children.map(children, child => (
						<li className={styles.item}>{child}</li>
					))}
				</ul>
			</div>
		</Root>
	)
}
