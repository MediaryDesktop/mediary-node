const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * 60 * 1000],
	['month', 30 * 24 * 60 * 60 * 1000],
	['week', 7 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000]
]

export function formatRelativeTime(value: string | Date, locale: string, now: Date = new Date()): string {
	const date = typeof value === 'string' ? new Date(value) : value
	const elapsed = date.getTime() - now.getTime()

	if (Number.isNaN(elapsed)) {
		return ''
	}

	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

	for (const [unit, milliseconds] of UNITS) {
		if (Math.abs(elapsed) >= milliseconds) {
			return format.format(Math.round(elapsed / milliseconds), unit)
		}
	}

	return format.format(0, 'minute')
}
