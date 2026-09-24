import clsx from 'clsx'
import { useCallback, useRef, useState } from 'react'
import type { MouseEvent, TouchEvent } from 'react'

import { Icon } from '../icon/Icon'

import styles from './RatingStars.module.scss'

export interface RatingStarsProps {
	min?: number
	max?: number
	step?: number
	starsCount?: number
	value?: number
	mode?: 'readonly' | 'editable' | 'drag'
	starColor?: string
	emptyStarColor?: string
	starSize?: number
	showValue?: boolean
	onChange?: (value: number) => void
	onPreviewChange?: (value: number | null) => void
}

function formatValue(value: number, min: number, max: number): string {
	return `${value <= min ? '–' : value.toFixed(1)}/${max}`
}

export function RatingStars({
	min = 0,
	max = 10,
	step = 0.1,
	starsCount = 5,
	value = 0,
	mode = 'editable',
	starColor = 'var(--accent)',
	emptyStarColor = 'var(--border-stronger)',
	starSize = 24,
	showValue = false,
	onChange,
	onPreviewChange
}: RatingStarsProps) {
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const isInteractive = mode !== 'readonly'
	const isDiscreteStarScale = step === 1 && starsCount === max - min
	const totalSteps = (max - min) / step
	const stepWidthPercent = 100 / totalSteps

	const displayValue = hoverValue ?? value

	const setPreview = useCallback(
		(next: number | null) => {
			setHoverValue(next)
			onPreviewChange?.(next)
		},
		[onPreviewChange]
	)

	const commitValue = useCallback(
		(next: number) => {
			onChange?.(next)
		},
		[onChange]
	)

	const calcValueFromEvent = useCallback(
		(clientX: number) => {
			const container = containerRef.current

			if (!container) {
				return null
			}

			const rect = container.getBoundingClientRect()
			const x = clientX - rect.left
			const epsilonPx = 2

			if (x <= epsilonPx) {
				return min
			}
			if (x >= rect.width - epsilonPx) {
				return max
			}

			const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
			const steps = Math.round((percent + 1e-6) / stepWidthPercent)

			return Number((min + steps * step).toFixed(2))
		},
		[min, max, step, stepWidthPercent]
	)

	const handleMove = (clientX: number) => {
		const next = calcValueFromEvent(clientX)

		if (next === null) {
			return
		}

		setPreview(next)

		if (isDragging && mode === 'drag') {
			commitValue(next)
		}
	}

	const handleMouseDown = (event: MouseEvent) => {
		if (mode !== 'drag') {
			return
		}

		setIsDragging(true)
		handleMove(event.clientX)
	}

	const handleMouseMove = (event: MouseEvent) => {
		if (!isInteractive) {
			return
		}

		if (mode === 'editable' || (mode === 'drag' && isDragging)) {
			handleMove(event.clientX)
		}
	}

	const handleMouseUp = () => {
		if (mode !== 'drag') {
			return
		}

		setIsDragging(false)

		if (hoverValue !== null) {
			commitValue(hoverValue)
		}
	}

	const handleClick = (event: MouseEvent) => {
		if (mode !== 'editable') {
			return
		}

		const next = calcValueFromEvent(event.clientX)

		if (next !== null) {
			commitValue(next)
		}
	}

	const handleTouchStart = (event: TouchEvent) => {
		if (!isInteractive) {
			return
		}

		if (mode === 'drag') {
			setIsDragging(true)
		}

		handleMove(event.touches[0]?.clientX ?? 0)
	}

	const handleTouchMove = (event: TouchEvent) => {
		if (!isInteractive) {
			return
		}

		handleMove(event.touches[0]?.clientX ?? 0)
	}

	const handleTouchEnd = (event: TouchEvent) => {
		if (!isInteractive) {
			return
		}

		if (mode === 'editable') {
			const next = calcValueFromEvent(event.changedTouches[0]?.clientX ?? 0)

			if (next !== null) {
				commitValue(next)
			}

			setPreview(null)
			return
		}

		if (mode !== 'drag') {
			return
		}

		setIsDragging(false)

		if (hoverValue !== null) {
			commitValue(hoverValue)
		}
	}

	const handleLeave = () => {
		if (!isDragging) {
			setPreview(null)
		}
	}

	const handleDiscreteStarEnter = (starValue: number) => {
		if (isInteractive) {
			setPreview(starValue)
		}
	}

	const handleDiscreteStarClick = (starValue: number) => {
		if (!isInteractive) {
			return
		}

		commitValue(value === starValue ? min : starValue)
		setPreview(null)
	}

	const valueLabel = showValue && (
		<span className={styles.value} aria-live='polite'>
			{formatValue(displayValue, min, max)}
		</span>
	)

	if (isDiscreteStarScale) {
		return (
			<div className={clsx(styles.root, !showValue && styles.rootBare)}>
				<div
					className={styles.container}
					style={{ fontSize: `${starSize}px` }}
					onMouseLeave={handleLeave}
					role='group'
					aria-label='Rating'
				>
					<div className={styles.row}>
						{Array.from({ length: starsCount }, (_, index) => {
							const starValue = min + index + 1
							const filled = displayValue >= starValue

							return (
								<button
									key={starValue}
									type='button'
									className={styles.star}
									disabled={!isInteractive}
									onMouseEnter={() => handleDiscreteStarEnter(starValue)}
									onFocus={() => handleDiscreteStarEnter(starValue)}
									onBlur={handleLeave}
									onClick={() => handleDiscreteStarClick(starValue)}
									aria-label={`Rate ${starValue} out of ${max}`}
								>
									{filled ? (
										<Icon name='common/star' size={starSize} color={starColor} />
									) : (
										<Icon name='common/star' size={starSize} color={emptyStarColor} />
									)}
								</button>
							)
						})}
					</div>
				</div>

				{valueLabel}
			</div>
		)
	}

	const percentFill = ((displayValue - min) / (max - min)) * 100

	return (
		<div className={clsx(styles.root, !showValue && styles.rootBare)}>
			<div
				className={styles.container}
				ref={containerRef}
				style={{ fontSize: `${starSize}px` }}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleLeave}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onClick={handleClick}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				role='group'
				aria-label='Rating'
			>
				<div className={styles.background}>
					{Array.from({ length: starsCount }, (_, index) => (
						<Icon name='common/star' key={index} size={starSize} color={emptyStarColor} />
					))}
				</div>

				<div className={styles.fill} style={{ width: `${percentFill}%` }}>
					{Array.from({ length: starsCount }, (_, index) => (
						<Icon name='common/star' key={index} size={starSize} color={starColor} />
					))}
				</div>
			</div>

			{valueLabel}
		</div>
	)
}
