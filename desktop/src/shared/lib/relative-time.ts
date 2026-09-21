const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * 60 * 1000],
	['month', 30 * 24 * 60 * 60 * 1000],
	['week', 7 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000]
]

export interface RelativeTimeOptions {
	now?: Date | number
	// Units coarser than this are skipped: an airing countdown reads better as
	// "in 10 days" than as "in 1 week".
	maxUnit?: Intl.RelativeTimeFormatUnit
}

export function formatRelativeTime(
	value: string | Date | number,
	locale: string,
	{ now = Date.now(), maxUnit }: RelativeTimeOptions = {}
): string {
	const target = value instanceof Date ? value.getTime() : new Date(value).getTime()
	const elapsed = target - (now instanceof Date ? now.getTime() : now)

	if (Number.isNaN(elapsed)) {
		return ''
	}

	const from = maxUnit ? UNITS.findIndex(([unit]) => unit === maxUnit) : 0
	const units = from < 0 ? UNITS : UNITS.slice(from)
	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

	for (const [unit, milliseconds] of units) {
		if (Math.abs(elapsed) >= milliseconds) {
			return format.format(Math.round(elapsed / milliseconds), unit)
		}
	}

	return format.format(0, 'minute')
}
