export function firstPresent(...values: (string | null | undefined)[]): string {
	return values.find(value => value != null) ?? ''
}
