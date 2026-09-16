const KNOWN_FORMATS = ['POINT_100', 'POINT_10_DECIMAL', 'POINT_10', 'POINT_5', 'POINT_3'] as const

export type ScoreFormat = (typeof KNOWN_FORMATS)[number]

const POINT_3_STEPS = [0, 35, 60, 100]

function isKnownFormat(format: string): format is ScoreFormat {
	return (KNOWN_FORMATS as readonly string[]).includes(format)
}

export function nextScore(raw: number, format: string, direction: 1 | -1): number {
	if (!isKnownFormat(format) || format === 'POINT_100') {
		return clamp(raw + direction, 0, 100)
	}

	if (format === 'POINT_3') {
		const index = POINT_3_STEPS.findIndex(step => step >= raw)
		const current = index === -1 ? POINT_3_STEPS.length - 1 : index
		return POINT_3_STEPS[clamp(current + direction, 0, POINT_3_STEPS.length - 1)] ?? 0
	}

	const step = format === 'POINT_10_DECIMAL' || format === 'POINT_10' ? 10 : 20

	return clamp(Math.round((raw + direction * step) / step) * step, 0, 100)
}

export function formatScoreValue(raw: number, format: string): string {
	if (raw <= 0) {
		return '–'
	}

	if (!isKnownFormat(format) || format === 'POINT_100') {
		return String(raw)
	}

	switch (format) {
		case 'POINT_10_DECIMAL':
			return (raw / 10).toFixed(1)
		case 'POINT_10':
			return String(Math.round(raw / 10))
		case 'POINT_5':
			return String(Math.round(raw / 20))
		case 'POINT_3':
			return raw >= 85 ? '😊' : raw >= 50 ? '😐' : '😞'
		default:
			return String(raw)
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}
