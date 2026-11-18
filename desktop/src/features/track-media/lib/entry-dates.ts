import { dateInputValue, parseDateInput } from '@shared/lib'

import type { TrackerEntry } from '@entities/tracker'

export type EntryDate = TrackerEntry['started_at']

export function dateToInput(date: EntryDate | undefined): string {
	return dateInputValue(date?.year, date?.month, date?.day)
}

export function inputToDate(value: string): EntryDate {
	return parseDateInput(value) ?? { year: null, month: null, day: null }
}
