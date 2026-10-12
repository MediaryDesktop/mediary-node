export function formatWeekday(value: string | Date | number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(value))
}

// A history list tells scans apart by when they ran, not by how long ago that
// was — two scans from the same afternoon both read as "today" otherwise.
export function formatDateTime(value: string | Date | number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(value)
	)
}

export function formatCompact(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

// Runtimes disagree about how to word a duration, and none of them produce the
// clock reading a video player shows. "23:57" is the same in every language the
// app speaks, so it is built here rather than translated.
export function formatDuration(seconds: number): string {
	const whole = Math.max(Math.round(seconds), 0)

	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const rest = whole % 60

	const pad = (value: number) => value.toString().padStart(2, '0')

	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

export function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']

	let value = bytes
	let unit = 0

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}

	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
