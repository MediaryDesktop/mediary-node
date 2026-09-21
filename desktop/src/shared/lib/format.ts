export function formatWeekday(value: string | Date | number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(value))
}

export function formatCompact(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
