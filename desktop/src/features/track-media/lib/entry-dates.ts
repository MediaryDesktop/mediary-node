import type { TrackerEntry } from '@entities/tracker'

export type EntryDate = TrackerEntry['started_at']

export function dateToInput(date: EntryDate | undefined): string {
	if (!date?.year || !date.month || !date.day) {
		return ''
	}

	const month = String(date.month).padStart(2, '0')
	const day = String(date.day).padStart(2, '0')

	return `${date.year}-${month}-${day}`
}

export function inputToDate(value: string): EntryDate {
	const [year, month, day] = value.split('-').map(Number)

	if (!year || !month || !day) {
		return { year: null, month: null, day: null }
	}

	return { year, month, day }
}

export function today(): string {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')

	return `${now.getFullYear()}-${month}-${day}`
}
