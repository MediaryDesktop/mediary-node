import clsx from 'clsx'
import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import styles from './ScoreDial.module.scss'

export interface ScoreDialProps {
	value?: number
	onChange: (value: number | undefined) => void
	disabled?: boolean
	className?: string
}

const MIN = 0
const MAX = 100
const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 90
const STROKE = 16
const START_ANGLE = 135
const SWEEP = 270
const GAP = 360 - SWEEP

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

function polarPoint(angleDeg: number) {
	const rad = (angleDeg * Math.PI) / 180
	return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

function arcPath(fromAngle: number, toAngle: number): string {
	const start = polarPoint(fromAngle)
	const end = polarPoint(toAngle)
	const largeArc = toAngle - fromAngle <= 180 ? 0 : 1

	return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function valueToAngle(value: number): number {
	return START_ANGLE + (clamp(value, MIN, MAX) / MAX) * SWEEP
}

function angleToValue(angleDeg: number): number {
	const shifted = (((angleDeg - START_ANGLE) % 360) + 360) % 360

	if (shifted <= SWEEP) {
		return Math.round((shifted / SWEEP) * MAX)
	}

	return shifted - SWEEP < GAP / 2 ? MAX : MIN
}

const COLOR_STOPS: [number, string][] = [
	[0, '#DC2626'], // Critical — червоний
	[40, '#F97316'], // Poor — помаранчевий
	[60, '#EAB308'], // Average — жовтий
	[70, '#A3E635'], // Good — салатовий
	[82, '#22C55E'], // Very good — зелений
	[100, '#15803D'] // Excellent — темно-зелений
]

function scoreColor(value: number): string {
	for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
		const [fromAt, fromColor] = COLOR_STOPS[i]!
		const [toAt, toColor] = COLOR_STOPS[i + 1]!

		if (value <= toAt || i === COLOR_STOPS.length - 2) {
			const span = toAt - fromAt
			const t = span === 0 ? 0 : clamp((value - fromAt) / span, 0, 1)
			return `color-mix(in srgb, ${toColor} ${Math.round(t * 100)}%, ${fromColor})`
		}
	}

	return COLOR_STOPS[0]![1]
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
				aria-valuetext={value === undefined ? t('manualMedia.notSpecified') : String(value / 10)}
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
						{/* Stored out of 100 like every other source's score, but shown out of
						10 with its decimal — the same scale the saved title's own page uses. */}
						<span className={styles.value}>{value === undefined ? '—' : value / 10}</span>
						<span className={styles.label}>{t('manualMedia.fields.score')}</span>
					</div>
				</div>
			</div>
		</Tooltip>
	)
}
