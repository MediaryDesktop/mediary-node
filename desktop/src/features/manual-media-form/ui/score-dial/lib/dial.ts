export const MIN = 0
export const MAX = 100
export const SIZE = 200
export const STROKE = 16
export const START_ANGLE = 135
export const SWEEP = 270

const CENTER = SIZE / 2
const RADIUS = 90
const GAP = 360 - SWEEP

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

export function polarPoint(angleDeg: number) {
	const rad = (angleDeg * Math.PI) / 180
	return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

export function arcPath(fromAngle: number, toAngle: number): string {
	const start = polarPoint(fromAngle)
	const end = polarPoint(toAngle)
	const largeArc = toAngle - fromAngle <= 180 ? 0 : 1

	return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function valueToAngle(value: number): number {
	return START_ANGLE + (clamp(value, MIN, MAX) / MAX) * SWEEP
}

export function angleToValue(angleDeg: number): number {
	const shifted = (((angleDeg - START_ANGLE) % 360) + 360) % 360

	if (shifted <= SWEEP) {
		return Math.round((shifted / SWEEP) * MAX)
	}

	return shifted - SWEEP < GAP / 2 ? MAX : MIN
}

// From critical through poor, average, good and very good to excellent.
const COLOR_STOPS: [number, string][] = [
	[0, '#DC2626'],
	[40, '#F97316'],
	[60, '#EAB308'],
	[70, '#A3E635'],
	[82, '#22C55E'],
	[100, '#15803D']
]

export function scoreColor(value: number): string {
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

// Stored out of 100 like every other source's score, but shown out of 10 with
// its decimal — the same scale the saved title's own page uses.
export function outOfTen(value: number): number {
	return value / 10
}
