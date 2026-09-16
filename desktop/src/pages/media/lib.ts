export function formatWeekday(target: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(target))
}

export function formatCompact(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['day', 86_400_000],
	['hour', 3_600_000],
	['minute', 60_000]
]

export function formatRelative(target: string, locale: string, now: number = Date.now()): string {
	const delta = new Date(target).getTime() - now
	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

	for (const [unit, size] of UNITS) {
		if (Math.abs(delta) >= size) {
			return format.format(Math.round(delta / size), unit)
		}
	}

	return format.format(0, 'minute')
}
