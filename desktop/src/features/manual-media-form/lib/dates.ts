import { dateInputValue, parseDateInput } from '@shared/lib'

export interface DateParts {
	year?: number
	month?: number
	day?: number
}

export function dateFromParts(year?: number, month?: number, day?: number): string {
	return dateInputValue(year, month, day)
}

export function partsFromDate(value: string): DateParts {
	return parseDateInput(value) ?? {}
}
