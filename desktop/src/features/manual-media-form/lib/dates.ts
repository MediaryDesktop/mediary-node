export function dateFromParts(year?: number, month?: number, day?: number): string {
	if (!year || !month || !day) {
		return ''
	}

	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface DateParts {
	year?: number
	month?: number
	day?: number
}

export function partsFromDate(value: string): DateParts {
	const [year, month, day] = value.split('-').map(Number)

	if (!year || !month || !day) {
		return {}
	}

	return { year, month, day }
}
