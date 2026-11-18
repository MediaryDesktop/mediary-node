export interface DateInputParts {
	year: number
	month: number
	day: number
}

// The value of an `<input type="date">` — "2026-03-07" — or '' while any
// part of the date is unknown.
export function dateInputValue(
	year: number | null | undefined,
	month: number | null | undefined,
	day: number | null | undefined
): string {
	if (!year || !month || !day) {
		return ''
	}

	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// The parts of an `<input type="date">` value; null for an empty or partial one.
export function parseDateInput(value: string): DateInputParts | null {
	const [year, month, day] = value.split('-').map(Number)

	if (!year || !month || !day) {
		return null
	}

	return { year, month, day }
}

export function todayInputValue(now = new Date()): string {
	return dateInputValue(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
