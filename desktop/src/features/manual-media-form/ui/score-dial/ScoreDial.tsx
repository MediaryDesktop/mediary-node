import clsx from 'clsx'
import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import {
	angleToValue,
	arcPath,
	clamp,
	MAX,
	MIN,
	outOfTen,
	polarPoint,
	scoreColor,
	SIZE,
	START_ANGLE,
	STROKE,
	SWEEP,
	valueToAngle
} from './lib/dial'
import styles from './ScoreDial.module.scss'

export interface ScoreDialProps {
	value?: number
	onChange: (value: number | undefined) => void
	disabled?: boolean
	className?: string
}

export function ScoreDial({ value, onChange, disabled, className }: ScoreDialProps) {
	const { t } = useTranslation()
	const ref = useRef<SVGSVGElement>(null)
	const dragging = useRef(false)

	const shown = value ?? 0
	const color = scoreColor(shown)
	const angle = valueToAngle(shown)

	const angleFromPointer = (event: { clientX: number; clientY: number }): number => {
		const box = ref.current!.getBoundingClientRect()
		const cx = box.left + box.width / 2
		const cy = box.top + box.height / 2
		return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
	}

	const apply = (event: { clientX: number; clientY: number }) => {
		onChange(angleToValue(angleFromPointer(event)))
	}

	const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (disabled) {
			return
		}

		dragging.current = true
		event.currentTarget.setPointerCapture(event.pointerId)
		apply(event)
	}

	const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (dragging.current) {
			apply(event)
		}
	}

	const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
		dragging.current = false
		event.currentTarget.releasePointerCapture(event.pointerId)
	}

	const step = (delta: number) => {
		if (disabled) {
			return
		}

		onChange(clamp(shown + delta, MIN, MAX))
	}

	const onKeyDown = (event: KeyboardEvent) => {
		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				event.preventDefault()
				step(1)
				return
			case 'ArrowLeft':
			case 'ArrowDown':
				event.preventDefault()
				step(-1)
				return
			case 'PageUp':
				event.preventDefault()
				step(10)
				return
			case 'PageDown':
				event.preventDefault()
				step(-10)
				return
			case 'Home':
				event.preventDefault()
				onChange(MIN)
				return
			case 'End':
				event.preventDefault()
				onChange(MAX)
		}
	}

	return (
		<Tooltip content={t('manualMedia.fields.scoreDialHint')} side='top'>
			<div
				className={clsx(styles.dial, disabled && styles.disabled, className)}
				role='slider'
				tabIndex={disabled ? -1 : 0}
				aria-label={t('manualMedia.fields.score')}
				aria-valuemin={MIN}
				aria-valuemax={MAX}
				aria-valuenow={value ?? 0}
				aria-valuetext={value === undefined ? t('manualMedia.notSpecified') : String(outOfTen(value))}
				onKeyDown={onKeyDown}
			>
				<svg
					ref={ref}
					className={styles.ring}
					width={SIZE}
					height={SIZE}
					viewBox={`0 0 ${SIZE} ${SIZE}`}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
				>
					<path
						className={styles.track}
						d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
						strokeWidth={STROKE}
						fill='none'
					/>

					{shown > MIN && (
						<path
							d={arcPath(START_ANGLE, angle)}
							strokeWidth={STROKE}
							fill='none'
							stroke={color}
							strokeLinecap='round'
						/>
					)}

					{shown > MIN && (
						<circle
							className={styles.thumb}
							cx={polarPoint(angle).x}
							cy={polarPoint(angle).y}
							r={STROKE / 2 + 2}
							fill='var(--surface)'
							stroke={color}
							strokeWidth={2.5}
						/>
					)}
				</svg>

				<div className={styles.center}>
					<Icon
						className={styles.starIcon}
						name='common/star'
						size={38}
						style={{ color: shown > MIN ? color : undefined }}
					/>

					<div className={styles.text}>
						<span className={styles.value}>{value === undefined ? '—' : outOfTen(value)}</span>
						<span className={styles.label}>{t('manualMedia.fields.score')}</span>
					</div>
				</div>
			</div>
		</Tooltip>
	)
}
